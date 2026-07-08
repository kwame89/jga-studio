import { Buffer } from 'buffer';

global.Buffer = global.Buffer || Buffer;
import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';

import 'expo-router/entry';
