import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase, SUPABASE_URL } from './supabase';

/** Limite des buckets publics (listing-media, profile-media) et du bucket privé de vérification. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type PickedImage = {
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number | null;
  mimeType?: string | null;
};

type PickOptions = {
  /** Nombre maximal d'images sélectionnables (1 = sélection simple). */
  max?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
};

/**
 * Ouvre la galerie. Renvoie une liste vide si l'utilisateur annule ; lève une erreur lisible
 * si la permission est refusée.
 */
export async function pickImages({ max = 1, allowsEditing = false, aspect }: PickOptions = {}): Promise<PickedImage[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Autorisez l’accès à vos photos dans les réglages pour ajouter une image.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: max > 1,
    selectionLimit: max,
    allowsEditing: max === 1 ? allowsEditing : false,
    aspect,
    quality: 1,
    exif: false,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height, fileSize: a.fileSize, mimeType: a.mimeType }));
}

/**
 * Redimensionne (1600 px max) et recompresse en JPEG avant envoi, comme `prepareImage()` du
 * site : les photos de smartphone de 5 à 10 Mo deviennent quelques centaines de Ko, et le
 * format est toujours accepté par les buckets (JPEG/PNG/WebP/GIF uniquement — pas de HEIC).
 */
export async function prepareImage(asset: PickedImage, maxSize = 1600, compress = 0.82): Promise<{ uri: string }> {
  const actions: ImageManipulator.Action[] = [];
  if (asset.width && asset.height && Math.max(asset.width, asset.height) > maxSize) {
    actions.push(asset.width >= asset.height ? { resize: { width: maxSize } } : { resize: { height: maxSize } });
  }
  try {
    const out = await ImageManipulator.manipulateAsync(asset.uri, actions, { compress, format: ImageManipulator.SaveFormat.JPEG });
    return { uri: out.uri };
  } catch (err) {
    console.warn('prepareImage: traitement impossible, envoi du fichier d’origine', err);
    return { uri: asset.uri };
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let out = 0;
  for (let i = 0; i < clean.length; i++) {
    buffer = ((buffer << 6) | B64.indexOf(clean[i])) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes.subarray(0, out);
}

/** Lit un fichier local en octets (fetch().blob() est peu fiable avec supabase-js sous React Native). */
async function readBytes(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return base64ToBytes(base64);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

type PublicBucket = 'listing-media' | 'profile-media';
type PublicFolder = 'images' | 'avatars' | 'banners';

/**
 * Envoie une image dans un bucket public et renvoie son URL publique.
 *
 * Chemin `<dossier>/<user_id>-<timestamp>-<aléa>.jpg` : la policy de stockage exige que le
 * dossier soit `images`, `avatars` ou `banners` et que le nom commence par l'id de l'appelant.
 */
export async function uploadImage(params: { bucket: PublicBucket; folder: PublicFolder; userId: string; asset: PickedImage }): Promise<string> {
  const { bucket, folder, userId, asset } = params;
  const prepared = await prepareImage(asset);
  const bytes = await readBytes(prepared.uri);
  if (bytes.byteLength > IMAGE_MAX_BYTES) throw new Error('Image trop lourde (10 Mo maximum).');
  if (bytes.byteLength === 0) throw new Error('Impossible de lire cette image.');

  const path = `${folder}/${userId}-${Date.now()}-${randomSuffix()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
  if (error) throw new Error(error.message || 'Échec du téléversement');

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Impossible de récupérer l’URL publique');
  return data.publicUrl;
}

/**
 * Pièce d'identité : bucket privé `verification-documents`, chemin `<user_id>/verification_<ts>.jpg`
 * (policy : seul le propriétaire écrit dans son dossier). Renvoie le chemin, que l'on stocke tel
 * quel dans `users.verification_document_url` (comme le site).
 */
export async function uploadVerificationDocument(userId: string, asset: PickedImage): Promise<string> {
  const prepared = await prepareImage(asset, 2000, 0.9);
  const bytes = await readBytes(prepared.uri);
  if (bytes.byteLength > IMAGE_MAX_BYTES) throw new Error('Fichier trop lourd (10 Mo maximum).');
  const path = `${userId}/verification_${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('verification-documents').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message || 'Échec du téléversement');
  return path;
}

/** Chemin d'un objet dans un bucket public à partir de son URL publique (pour la suppression). */
export function storagePathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/`;
  if (!url.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(url.slice(prefix.length).split('?')[0]);
  } catch {
    return null;
  }
}

/** Supprime un objet à partir de son URL publique. Silencieux : une image orpheline n'est pas bloquante. */
export async function removeStorageObject(bucket: PublicBucket, url: string | null | undefined): Promise<void> {
  const path = storagePathFromPublicUrl(url, bucket);
  if (!path) return;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.warn('Suppression du média impossible :', error.message);
}
