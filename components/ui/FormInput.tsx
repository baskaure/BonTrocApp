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
};

export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  error,
  inputProps = {},
  containerStyle,
}: FormInputProps<T>) {
  const { colors } = useTheme();
  const { style: inputStyle, ...restInputProps } = inputProps;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      )}
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: error ? colors.error : colors.border,
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
        )}
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
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
});
