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

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC = '۰۱۲۳۴۵۶۷۸۹';

function normalizePasswordInput(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const ai = ARABIC_INDIC.indexOf(ch);
    if (ai >= 0) {
      out += String(ai);
      continue;
    }
    const ea = EASTERN_ARABIC.indexOf(ch);
    if (ea >= 0) {
      out += String(ea);
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      out += ch.toUpperCase();
      continue;
    }
    if (/[0-9\x20-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/.test(ch)) {
      out += ch;
      continue;
    }
  }
  return out;
}

type Props = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export default function PasswordInput({
  containerStyle,
  inputStyle,
  style,
  onChangeText,
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
        autoCapitalize="characters"
        autoCorrect={false}
        onChangeText={(text) => onChangeText?.(normalizePasswordInput(text))}
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
