import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Controller, Control, FieldValues, Path, FieldError } from 'react-hook-form';
import { useTheme } from '@/lib/theme';

type FormInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  error?: FieldError;
  inputProps?: TextInputProps;
  containerStyle?: object;
  /** Icône optionnelle à gauche du champ (ex. <Mail />). Rétro-compatible : sans icône, rendu inchangé. */
  leftIcon?: React.ReactNode;
  /** Élément optionnel à droite du champ (ex. bouton œil). Nécessite leftIcon pour le conteneur en ligne. */
  rightIcon?: React.ReactNode;
};

export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  error,
  inputProps = {},
  containerStyle,
  leftIcon,
  rightIcon,
}: FormInputProps<T>) {
  const { colors } = useTheme();
  const { style: inputStyle, ...restInputProps } = inputProps;
  const borderColor = error ? colors.error : colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      )}
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) =>
          leftIcon || rightIcon ? (
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor }]}>
              {leftIcon}
              <TextInput
                style={[styles.inputRowField, { color: colors.text }, inputStyle]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholderTextColor={colors.textTertiary}
                {...restInputProps}
              />
              {rightIcon}
            </View>
          ) : (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor,
                  color: colors.text,
                },
                inputStyle,
              ]}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholderTextColor={colors.textTertiary}
              {...restInputProps}
            />
          )
        }
      />
      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>{error.message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  input: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 14,
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
  },
  inputRowField: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
});
