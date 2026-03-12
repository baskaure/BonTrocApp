import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import { useTheme } from '@/lib/theme';
import { X } from 'lucide-react-native';

type FormTagInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  placeholder?: string;
  tagStyle?: 'primary' | 'success';
};

export function FormTagInput<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = 'Ajouter...',
  tagStyle = 'primary',
}: FormTagInputProps<T>) {
  const { colors } = useTheme();
  const [inputValue, setInputValue] = useState('');

  const tagBg = tagStyle === 'success' ? colors.successLight : colors.primaryLight;
  const tagColor = tagStyle === 'success' ? colors.success : colors.primary;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => {
        const tags = (value || []) as string[];
        const addTag = () => {
          const trimmed = inputValue.trim();
          if (trimmed && !tags.includes(trimmed)) {
            onChange([...tags, trimmed]);
            setInputValue('');
          }
        };
        const removeTag = (tag: string) => {
          onChange(tags.filter((t) => t !== tag));
        };

        return (
          <View style={styles.container}>
            {label && (
              <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
            )}
            <View style={styles.tags}>
              {tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: tagBg }]}>
                  <Text style={[styles.tagText, { color: tagColor }]}>{tag}</Text>
                  <TouchableOpacity onPress={() => removeTag(tag)}>
                    <X size={14} color={tagColor} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.addRow}>
              <TextInput
                style={[
                  styles.addInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder={placeholder}
                placeholderTextColor={colors.textTertiary}
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addButton} onPress={addTag}>
                <Text style={[styles.addButtonText, { color: colors.primary }]}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
