import { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export default function PasswordInput({
  containerStyle,
  inputStyle,
  style,
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      <TextInput
        {...props}
        style={[styles.input, style, inputStyle]}
        secureTextEntry={!visible}
        textAlign={props.textAlign || 'right'}
        autoCapitalize={props.autoCapitalize || 'none'}
      />
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setVisible((v) => !v)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color="#64748b"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    paddingLeft: 44,
    fontSize: 16,
  },
  toggle: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
  },
});
