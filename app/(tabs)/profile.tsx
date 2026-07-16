import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Platform,
  TextInput,
  ActivityIndicator,
  Linking,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import QRCodeStyled from 'react-native-qrcode-styled';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import {
  usePrivy,
  useLoginWithEmail,
  useEmbeddedEthereumWallet,
} from '@privy-io/expo';
import { useCreateWallet } from '@privy-io/expo/extended-chains';
import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  http,
  parseEther,
  parseUnits,
} from 'viem';
import { base } from 'viem/chains';
import { useTheme } from '../../themeContext';
import { supabase } from '../../supabaseClient';
import StudioCatalogManager from '../../components/StudioCatalogManager';

type WishlistItem = {
  id: number;
  title: string;
  image_url: string;
  price_usd: number;
};

type SavedWalletRecord = {
  id: number;
  created_at: string | null;
  last_seen_at: string | null;
  email: string;
  privy_user_id: string;
  wallet_address: string;
  chain_type: string;
  wallet_provider: string;
  is_admin: boolean;
  display_name: string | null;
};

type RewardEvent = {
  id: number;
  created_at: string | null;
  purchase_id: number | null;
  buyer_email: string | null;
  buyer_wallet: string | null;
  token_symbol: string;
  token_contract: string;
  reward_amount: number;
  reward_formula: string | null;
  status: string;
  claimed_at: string | null;
  notes: string | null;
};

type TokenKey = 'ETH' | 'USDC' | 'JGA' | 'ZORA';

type TokenOption = {
  key: TokenKey;
  label: string;
  symbol: string;
  type: 'native' | 'erc20';
  decimals: number;
  contractAddress?: `0x${string}`;
  configured: boolean;
  accent: string;
  icon: any;
};

type TokenBalanceMap = Record<TokenKey, string | null>;

type TransferItem = {
  id: string;
  hash: string;
  from: string | null;
  to: string | null;
  asset: string;
  value: number | null;
  category: string;
  blockNum: string;
  timestamp: string | null;
  direction: 'sent' | 'received';
};

type AlchemyTransfer = {
  hash?: string;
  from?: string | null;
  to?: string | null;
  asset?: string | null;
  value?: number | null;
  category?: string | null;
  blockNum?: string;
  uniqueId?: string;
  metadata?: {
    blockTimestamp?: string;
  };
};

const BASE_CHAIN_ID_HEX = '0x2105';
const BASE_RPC_URL =
  process.env.EXPO_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

const baseClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL),
});

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const TOKEN_OPTIONS: TokenOption[] = [
  {
    key: 'ETH',
    label: 'Base ETH',
    symbol: 'ETH',
    type: 'native',
    decimals: 18,
    configured: true,
    accent: '#8B7CF6',
    icon: require('../../assets/tokens/eth.png'),
  },
  {
    key: 'USDC',
    label: 'USDC',
    symbol: 'USDC',
    type: 'erc20',
    decimals: 6,
    contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    configured: true,
    accent: '#2775CA',
    icon: require('../../assets/tokens/usdc.png'),
  },
  {
    key: 'JGA',
    label: 'JGA_STUDIO',
    symbol: 'JGA',
    type: 'erc20',
    decimals: 18,
    contractAddress: '0xcc3b754f6f3c508518ba7d0920f944d800c14b9a',
    configured: true,
    accent: '#C9985A',
    icon: require('../../assets/tokens/jga.png'),
  },
  {
    key: 'ZORA',
    label: 'ZORA',
    symbol: 'ZORA',
    type: 'erc20',
    decimals: 18,
    contractAddress: '0x1111111111166b7fe7bd91427724b487980afc69',
    configured: true,
    accent: '#6ECF8E',
    icon: require('../../assets/tokens/zora.png'),
  },
];

function formatTokenDisplay(value: bigint, decimals: number) {
  const raw = formatUnits(value, decimals);
  const numeric = Number(raw);

  if (!Number.isFinite(numeric)) return raw;
  if (numeric === 0) return '0';
  if (numeric >= 1000) {
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (numeric >= 1) return numeric.toFixed(4);
  return numeric.toFixed(6);
}

function formatTokenInputForPreview(value: string) {
  if (!value.trim()) return '0';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return '0';
  if (numeric >= 1000) {
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (numeric >= 1) return numeric.toFixed(4);
  return numeric.toFixed(6);
}

function getTokenStatusText(token: TokenOption) {
  if (token.type === 'native') return 'Native asset on Base';
  if (token.configured) return 'ERC-20 on Base';
  return 'ERC-20 contract not set';
}

function truncateHash(value: string, start = 12, end = 8) {
  if (!value) return '';
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function isAlchemyRpc(url: string) {
  return /alchemy\.com/i.test(url);
}

function buildAlchemyBody(params: Record<string, any>) {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'alchemy_getAssetTransfers',
    params: [params],
  };
}

function safeNumber(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatHistoryAmount(value: number | null) {
  if (value === null) return '—';
  if (value === 0) return '0';
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (Math.abs(value) >= 1) return value.toFixed(4);
  return value.toFixed(6);
}

function formatShortAddress(value: string | null | undefined) {
  if (!value) return '—';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatHistoryDate(value: string | null) {
  if (!value) return 'Pending';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'Pending';
  }
}

function transferSortValue(item: TransferItem) {
  if (item.timestamp) {
    const ms = new Date(item.timestamp).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  return parseInt(item.blockNum || '0x0', 16);
}

export default function Profile() {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);

  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [hasScannedQr, setHasScannedQr] = useState(false);

  const [tokenBalances, setTokenBalances] = useState<TokenBalanceMap>({
    ETH: null,
    USDC: null,
    JGA: null,
    ZORA: null,
  });
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [savedWalletRecord, setSavedWalletRecord] =
    useState<SavedWalletRecord | null>(null);
  const [savedWalletLoading, setSavedWalletLoading] = useState(false);

  const [rewardEvents, setRewardEvents] = useState<RewardEvent[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);

  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [selectedSendToken, setSelectedSendToken] = useState<TokenKey>('ETH');
  const [sendLoading, setSendLoading] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const [txHistory, setTxHistory] = useState<TransferItem[]>([]);
  const [txHistoryLoading, setTxHistoryLoading] = useState(false);
  const [txHistoryError, setTxHistoryError] = useState<string | null>(null);

  const { user, logout, isReady, getAccessToken } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { wallets } = useEmbeddedEthereumWallet();
  const { createWallet } = useCreateWallet();

  const email =
    user?.linked_accounts?.find((acc: any) => acc.type === 'email')?.address ??
    null;

  const [isAdmin, setIsAdmin] = useState(false);
  const isSignedIn = !!user;
  const walletAddress = wallets?.[0]?.address ?? null;
  const walletReady = !!walletAddress;
  const isLoadingPrivy = !isReady;

  const selectedTokenConfig = useMemo(() => {
    return (
      TOKEN_OPTIONS.find((token) => token.key === selectedSendToken) ||
      TOKEN_OPTIONS[0]
    );
  }, [selectedSendToken]);

  const selectedTokenBalance = useMemo(() => {
    return tokenBalances[selectedSendToken];
  }, [tokenBalances, selectedSendToken]);

  const claimableRewardEvents = useMemo(
    () => rewardEvents.filter((event) => event.status === 'claimable'),
    [rewardEvents]
  );

  const claimableRewardTotal = useMemo(() => {
    return claimableRewardEvents.reduce(
      (sum, event) => sum + Number(event.reward_amount || 0),
      0
    );
  }, [claimableRewardEvents]);

  const claimedRewardEvents = useMemo(
    () => rewardEvents.filter((event) => event.status === 'claimed'),
    [rewardEvents]
  );

  const syncWalletToSupabase = async (address: string) => {
    try {
      if (!user?.id || !email) return;

      const payload = {
        email,
        privy_user_id: user.id,
        wallet_address: address,
        chain_type: 'ethereum',
        wallet_provider: 'privy',
        is_admin: false,
        display_name: email,
        last_seen_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('collector_wallets')
        .upsert(payload, { onConflict: 'wallet_address' });

      if (error) {
        console.error('SUPABASE WALLET SYNC ERROR', error);
      } else {
        console.log('SUPABASE WALLET SYNC OK', payload);
      }
    } catch (err) {
      console.error('SUPABASE WALLET SYNC FAILED', err);
    }
  };

  const fetchSavedWalletRecord = async () => {
    try {
      if (!walletAddress) {
        setSavedWalletRecord(null);
        return;
      }

      setSavedWalletLoading(true);

      const { data, error } = await supabase
        .from('collector_wallets')
        .select('*')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (error) {
        console.error('FETCH SAVED WALLET ERROR', error);
        setSavedWalletRecord(null);
      } else {
        setSavedWalletRecord(data as SavedWalletRecord | null);
      }
    } catch (err) {
      console.error('FETCH SAVED WALLET FAILED', err);
      setSavedWalletRecord(null);
    } finally {
      setSavedWalletLoading(false);
    }
  };

  const fetchRewardEvents = async () => {
    try {
      if (!walletAddress && !email) {
        setRewardEvents([]);
        return;
      }

      setRewardsLoading(true);

      let query = supabase
        .from('reward_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (walletAddress) {
        query = query.eq('buyer_wallet', walletAddress);
      } else if (email) {
        query = query.eq('buyer_email', email);
      }

      const { data, error } = await query;

      if (error) {
        console.error('FETCH REWARD EVENTS ERROR', error);
        setRewardEvents([]);
      } else {
        setRewardEvents((data || []) as RewardEvent[]);
      }
    } catch (err) {
      console.error('FETCH REWARD EVENTS FAILED', err);
      setRewardEvents([]);
    } finally {
      setRewardsLoading(false);
    }
  };

  const refreshBalances = async () => {
    if (!walletAddress) {
      setTokenBalances({
        ETH: null,
        USDC: null,
        JGA: null,
        ZORA: null,
      });
      return;
    }

    try {
      setBalanceLoading(true);

      const nextBalances: TokenBalanceMap = {
        ETH: null,
        USDC: null,
        JGA: null,
        ZORA: null,
      };

      try {
        const ethWei = await baseClient.getBalance({
          address: walletAddress as `0x${string}`,
        });
        nextBalances.ETH = formatTokenDisplay(ethWei, 18);
      } catch (ethError: any) {
        console.error('BALANCE ERROR ETH', ethError);
        nextBalances.ETH =
          ethError?.message?.includes('429') ||
          ethError?.message?.includes('rate limit')
            ? 'Rate limited'
            : 'Unavailable';
      }

      for (const token of TOKEN_OPTIONS.filter((t) => t.type === 'erc20')) {
        if (!token.contractAddress || !token.configured) {
          nextBalances[token.key] = 'Not configured';
          continue;
        }

        try {
          const tokenBalance = await baseClient.readContract({
            address: token.contractAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`],
          });

          nextBalances[token.key] = formatTokenDisplay(
            tokenBalance,
            token.decimals
          );
        } catch (tokenError: any) {
          console.error(`BALANCE ERROR ${token.symbol}`, tokenError);
          nextBalances[token.key] =
            tokenError?.message?.includes('429') ||
            tokenError?.message?.includes('rate limit')
              ? 'Rate limited'
              : 'Unavailable';
        }
      }

      setTokenBalances(nextBalances);
    } catch (error) {
      console.error('Balance fetch error:', error);
      setTokenBalances({
        ETH: null,
        USDC: null,
        JGA: null,
        ZORA: null,
      });
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchTransferSide = async (direction: 'sent' | 'received') => {
    if (!walletAddress) return [];

    const params =
      direction === 'sent'
        ? {
            fromBlock: '0x0',
            fromAddress: walletAddress,
            category: ['external', 'erc20'],
            withMetadata: true,
            excludeZeroValue: true,
            maxCount: '0xa',
          }
        : {
            fromBlock: '0x0',
            toAddress: walletAddress,
            category: ['external', 'erc20'],
            withMetadata: true,
            excludeZeroValue: true,
            maxCount: '0xa',
          };

    const response = await fetch(BASE_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildAlchemyBody(params)),
    });

    const json = await response.json();

    if (!response.ok || json?.error) {
      throw new Error(
        json?.error?.message ||
          `Could not fetch ${direction} transaction history.`
      );
    }

    const transfers: AlchemyTransfer[] = json?.result?.transfers || [];

    return transfers.map((item, index) => ({
      id:
        item.uniqueId ||
        `${item.hash || 'tx'}-${direction}-${index}-${item.asset || 'asset'}`,
      hash: item.hash || '',
      from: item.from || null,
      to: item.to || null,
      asset: item.asset || 'ASSET',
      value: safeNumber(item.value),
      category: item.category || 'transfer',
      blockNum: item.blockNum || '0x0',
      timestamp: item.metadata?.blockTimestamp || null,
      direction,
    })) as TransferItem[];
  };

  const fetchTransactionHistory = async () => {
    if (!walletAddress) {
      setTxHistory([]);
      setTxHistoryError(null);
      return;
    }

    if (!isAlchemyRpc(BASE_RPC_URL)) {
      setTxHistory([]);
      setTxHistoryError('Transaction history needs an Alchemy Base RPC URL.');
      return;
    }

    try {
      setTxHistoryLoading(true);
      setTxHistoryError(null);

      const [sent, received] = await Promise.all([
        fetchTransferSide('sent'),
        fetchTransferSide('received'),
      ]);

      const deduped = new Map<string, TransferItem>();

      [...sent, ...received].forEach((item) => {
        const key = `${item.hash}-${item.direction}-${item.asset}-${item.value}-${item.from}-${item.to}`;
        if (!deduped.has(key)) {
          deduped.set(key, item);
        }
      });

      const merged = Array.from(deduped.values())
        .sort((a, b) => transferSortValue(b) - transferSortValue(a))
        .slice(0, 8);

      setTxHistory(merged);
    } catch (error: any) {
      console.error('TX HISTORY ERROR', error);
      setTxHistory([]);
      setTxHistoryError(error?.message || 'Could not load transaction history.');
    } finally {
      setTxHistoryLoading(false);
    }
  };

  useEffect(() => {
    const loadWishlist = async () => {
      try {
        const saved = await AsyncStorage.getItem('wishlist');
        if (saved) setWishlist(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading wishlist:', e);
      }
    };

    loadWishlist();
  }, []);

  useEffect(() => {
    if (walletAddress) {
      refreshBalances();
      fetchTransactionHistory();
    } else {
      setTxHistory([]);
      setTxHistoryError(null);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress && email && user?.id) {
      syncWalletToSupabase(walletAddress);
    }
  }, [walletAddress, email, user?.id]);

  useEffect(() => {
    if (isSignedIn && walletAddress) {
      fetchSavedWalletRecord();
    } else {
      setSavedWalletRecord(null);
    }
  }, [isSignedIn, walletAddress]);

  useEffect(() => {
    if (isSignedIn && (walletAddress || email)) {
      fetchRewardEvents();
    } else {
      setRewardEvents([]);
    }
  }, [isSignedIn, walletAddress, email]);

  const displayName = useMemo(() => {
    return email || 'Collector';
  }, [email]);

  const shortWallet = useMemo(() => {
    if (!walletAddress) return 'No wallet connected';
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const walletStatusLabel = useMemo(() => {
    if (!isSignedIn) return 'Wallet Locked';
    if (walletReady) return 'Wallet Ready';
    return 'No Wallet Yet';
  }, [isSignedIn, walletReady]);

  const removeFromWishlist = async (id: number) => {
    const updated = wishlist.filter((item) => item.id !== id);
    setWishlist(updated);
    try {
      await AsyncStorage.setItem('wishlist', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving wishlist:', e);
    }
  };

  const handleSendCode = async () => {
    try {
      if (isSignedIn) {
        Alert.alert(
          'Already signed in',
          'A Privy session already exists on this device. Use Sign Out first if you want to log in with a different email.'
        );
        return;
      }

      if (!emailInput.trim()) {
        Alert.alert('Email required', 'Enter your email address first.');
        return;
      }

      await sendCode({ email: emailInput.trim() });
      setCodeSent(true);
      Alert.alert('Code sent', 'Check your email for the login code.');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Login error', error?.message || 'Could not send code.');
    }
  };

  const handleLogin = async () => {
    try {
      if (isSignedIn) {
        Alert.alert(
          'Already signed in',
          'You already have an active Privy session. Use Sign Out first if needed.'
        );
        return;
      }

      if (!emailInput.trim() || !code.trim()) {
        Alert.alert('Missing fields', 'Enter both email and code.');
        return;
      }

      await loginWithCode({
        email: emailInput.trim(),
        code: code.trim(),
      });

      setCode('');
      Alert.alert(
        'Signed in',
        'Login succeeded. You can now create your embedded wallet.'
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert('Login error', error?.message || 'Could not complete login.');
    }
  };

  const handleCreateWallet = async () => {
    try {
      if (!isSignedIn) {
        Alert.alert('Sign in required', 'Please sign in first.');
        return;
      }

      if (walletReady) {
        Alert.alert('Wallet already exists', walletAddress || '');
        return;
      }

      const result = await createWallet({
        chainType: 'ethereum',
      });

      const newAddress = result?.wallet?.address;

      console.log('CREATE WALLET RESULT', result);
      console.log('NEW WALLET ADDRESS:', newAddress);

      if (newAddress) {
        await syncWalletToSupabase(newAddress);
      }

      Alert.alert('Success', 'Your embedded wallet was created.');
    } catch (error: any) {
      console.error('CREATE WALLET ERROR', error);
      Alert.alert('Wallet error', error?.message || 'Could not create wallet.');
    }
  };

  const handleCopyAddress = async () => {
    if (!walletAddress) return;

    try {
      await Clipboard.setStringAsync(walletAddress);
      Alert.alert('Copied', 'Wallet address copied to clipboard.');
    } catch (error) {
      console.error(error);
      Alert.alert('Copy failed', 'Could not copy wallet address.');
    }
  };

  const handleCopyTxHash = async () => {
    if (!lastTxHash) return;

    try {
      await Clipboard.setStringAsync(lastTxHash);
      Alert.alert('Copied', 'Transaction hash copied to clipboard.');
    } catch (error) {
      console.error(error);
      Alert.alert('Copy failed', 'Could not copy transaction hash.');
    }
  };

  const handleOpenTxHash = async (hash?: string | null) => {
    const txHash = hash || lastTxHash;
    if (!txHash) return;

    try {
      await Linking.openURL(`https://basescan.org/tx/${txHash}`);
    } catch (error) {
      console.error(error);
      Alert.alert('Unable to open link', 'Could not open transaction right now.');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            setCode('');
            setCodeSent(false);
            setEmailInput('');
            setReceiveModalVisible(false);
            setSendModalVisible(false);
            setQrScannerVisible(false);
            setHasScannedQr(false);
            setTokenBalances({
              ETH: null,
              USDC: null,
              JGA: null,
              ZORA: null,
            });
            setSavedWalletRecord(null);
            setRewardEvents([]);
            setSendTo('');
            setSendAmount('');
            setSelectedSendToken('ETH');
            setLastTxHash(null);
            setTxHistory([]);
            setTxHistoryError(null);
          } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Could not sign out.');
          }
        },
      },
    ]);
  };

  const handleWalletPress = () => {
    if (!isSignedIn) {
      Alert.alert(
        'Wallet status',
        'Sign in to create and connect your embedded wallet.'
      );
      return;
    }

    if (!walletReady) {
      Alert.alert(
        'No wallet yet',
        'You are signed in, but you have not created an embedded wallet yet. Tap Create Wallet.'
      );
      return;
    }

    setReceiveModalVisible(true);
  };

  const handleOpenSend = () => {
    if (!walletReady) {
      Alert.alert('No wallet yet', 'Create your wallet first.');
      return;
    }

    setSendModalVisible(true);
  };

  const handleOpenQrScanner = async () => {
    try {
      if (!cameraPermission?.granted) {
        const permissionResult = await requestCameraPermission();

        if (!permissionResult.granted) {
          Alert.alert(
            'Camera permission needed',
            'Please allow camera access to scan a wallet QR code.'
          );
          return;
        }
      }

      setHasScannedQr(false);
      setQrScannerVisible(true);
    } catch (error) {
      console.error('QR SCANNER OPEN ERROR', error);
      Alert.alert('Camera error', 'Could not open the QR scanner.');
    }
  };

const handleQrScanned = ({ data }: { data: string }) => {
  if (hasScannedQr) return;

  setHasScannedQr(true);

  const scannedValue = data?.trim?.() || '';
  let parsedAddress = scannedValue;

  if (scannedValue.startsWith('ethereum:')) {
    parsedAddress = scannedValue
      .replace('ethereum:', '')
      .split('@')[0]
      .split('?')[0];
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(parsedAddress)) {
    Alert.alert(
      'Invalid QR code',
      'That QR code did not contain a valid Ethereum/Base wallet address.'
    );
    setTimeout(() => setHasScannedQr(false), 1200);
    return;
  }

  setSendTo(parsedAddress);
  setQrScannerVisible(false);
  setHasScannedQr(false);

  Alert.alert(
    'Address scanned',
    `Recipient set to ${parsedAddress.slice(0, 6)}...${parsedAddress.slice(-4)}`
  );
};

  const handleOpenBaseScan = async () => {
    if (!walletAddress) return;

    const url = `https://basescan.org/address/${walletAddress}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error(error);
      Alert.alert('Unable to open link', 'Could not open BaseScan right now.');
    }
  };

  const handleClaimRewards = async () => {
    try {
      if (claimableRewardTotal <= 0) {
        Alert.alert(
          'No rewards available',
          'You do not have any claimable JGA_STUDIO rewards right now.'
        );
        return;
      }

      Alert.alert(
        'Processing Claim',
        `Claiming ${claimableRewardTotal.toFixed(2)} JGA_STUDIO...`
      );

      const { data, error } = await supabase.functions.invoke('claim-rewards');

      if (error) {
        throw error;
      }

      if (data?.hash) {
        setLastTxHash(data.hash);
      }

      await Promise.all([
        fetchRewardEvents(),
        refreshBalances(),
        fetchTransactionHistory(),
      ]);

      Alert.alert(
        'Rewards Claimed',
        `${data?.claimed || claimableRewardTotal} JGA_STUDIO sent successfully.`
      );
    } catch (error: any) {
      console.error('CLAIM REWARDS ERROR', error);

      Alert.alert('Claim failed', error?.message || 'Could not claim rewards.');
    }
  };

  const handleRefreshWalletData = async () => {
    await Promise.all([refreshBalances(), fetchTransactionHistory()]);
  };

  const handleSendTransaction = async () => {
    try {
      if (!walletReady || !wallets?.[0]) {
        Alert.alert('Wallet unavailable', 'Create or reconnect your wallet first.');
        return;
      }

      const to = sendTo.trim();
      const amount = sendAmount.trim();
      const token = selectedTokenConfig;

      if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
        Alert.alert('Invalid address', 'Enter a valid Ethereum/Base wallet address.');
        return;
      }

      if (!amount || Number(amount) <= 0) {
        Alert.alert('Invalid amount', `Enter a valid amount of ${token.symbol} to send.`);
        return;
      }

      if (token.type === 'erc20' && (!token.contractAddress || !token.configured)) {
        Alert.alert(
          'Token not configured',
          `${token.label} does not have a contract address configured yet. Add the Base contract first.`
        );
        return;
      }

      setSendLoading(true);

      const provider: any = await wallets[0].getProvider();

      const currentChainId = await provider.request({
        method: 'eth_chainId',
      });

      if (currentChainId !== BASE_CHAIN_ID_HEX) {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_CHAIN_ID_HEX }],
        });
      }

      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      });

      const from = accounts?.[0];

      if (!from) {
        throw new Error('No wallet account available.');
      }

      let txHash: string;

      if (token.type === 'native') {
        const valueHex = `0x${parseEther(amount).toString(16)}`;

        txHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from,
              to,
              value: valueHex,
            },
          ],
        });
      } else {
        const parsedAmount = parseUnits(amount, token.decimals);

        const data = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [to as `0x${string}`, parsedAmount],
        });

        txHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from,
              to: token.contractAddress,
              data,
              value: '0x0',
            },
          ],
        });
      }

      setLastTxHash(String(txHash));

      await Promise.all([refreshBalances(), fetchTransactionHistory()]);

      setSendModalVisible(false);
      setQrScannerVisible(false);
      setHasScannedQr(false);
      setSendTo('');
      setSendAmount('');
      setSelectedSendToken('ETH');

      Alert.alert(
        'Transaction sent',
        `Your ${token.symbol} transaction was submitted.\n\nHash: ${String(txHash).slice(0, 18)}...`
      );
    } catch (error: any) {
      console.error('SEND TRANSACTION ERROR', error);
      Alert.alert('Send failed', error?.message || 'Could not send the transaction.');
    } finally {
      setSendLoading(false);
    }
  };

  if (isLoadingPrivy) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image source={require('../../assets/logo.png')} style={styles.avatar} />

          <Text style={styles.name}>
            {isSignedIn ? 'JGA Studio Collector' : 'JGA Studio Profile'}
          </Text>

          <Text style={styles.role}>
            {isSignedIn ? displayName : 'Collector Identity Hub'}
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>
                {isSignedIn ? 'Signed In' : 'Guest Access'}
              </Text>
            </View>

            <View style={styles.walletBadge}>
              <Ionicons name="wallet-outline" size={14} color={theme.accent} />
              <Text style={styles.walletBadgeText}>{walletStatusLabel}</Text>
            </View>

            {isAdmin && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#fff" />
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
          </View>
        </View>

        <Section title="Studio Identity">
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="person-circle-outline" size={22} color={theme.accent} />
              <Text style={styles.cardTitle}>Account</Text>
            </View>

            <Text style={styles.cardText}>
              {isSignedIn
                ? `Signed in as ${displayName}`
                : 'Sign in to access your wallet, collector tools, and future rewards.'}
            </Text>

            {isSignedIn ? (
              <>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() =>
                    Alert.alert('Account Details', `Signed in as:\n${displayName}`)
                  }
                >
                  <Text style={styles.secondaryButtonText}>View Account Status</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.signOutInline} onPress={handleLogout}>
                  <Text style={styles.signOutInlineText}>Sign Out</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="Email address"
                  placeholderTextColor={theme.isDark ? '#8f8f8f' : '#8a8a8a'}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />

                {codeSent && (
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="Login code"
                    placeholderTextColor={theme.isDark ? '#8f8f8f' : '#8a8a8a'}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                )}

                {!codeSent ? (
                  <TouchableOpacity style={styles.primaryButton} onPress={handleSendCode}>
                    <Text style={styles.primaryButtonText}>Send Login Code</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
                    <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </Section>

        <Section title="Wallet & Rewards">
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="wallet-outline" size={22} color={theme.accent} />
              <Text style={styles.cardTitle}>Embedded Wallet</Text>
            </View>

            {!isSignedIn ? (
              <Text style={styles.cardText}>
                Sign in to create an embedded wallet and unlock collector features.
              </Text>
            ) : walletReady ? (
              <>
                <Text style={styles.cardText}>Connected wallet: {shortWallet}</Text>

                <View style={styles.tokenPortfolioCard}>
                  <View style={styles.portfolioHeaderRow}>
                    <Text style={styles.portfolioTitle}>Token Portfolio</Text>

                    <TouchableOpacity
                      style={styles.refreshPill}
                      onPress={handleRefreshWalletData}
                      disabled={balanceLoading || txHistoryLoading}
                    >
                      {balanceLoading || txHistoryLoading ? (
                        <ActivityIndicator size="small" color={theme.accent} />
                      ) : (
                        <>
                          <Ionicons name="refresh-outline" size={14} color={theme.accent} />
                          <Text style={styles.refreshPillText}>Refresh</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {TOKEN_OPTIONS.map((token) => (
                    <View key={token.key} style={styles.tokenRow}>
                      <View style={styles.tokenLeft}>
                        <View
                          style={[
                            styles.tokenIconBubble,
                            {
                              backgroundColor: `${token.accent}22`,
                              borderColor: `${token.accent}55`,
                            },
                          ]}
                        >
                          <Image
                            source={token.icon}
                            style={styles.tokenIconImage}
                            resizeMode="contain"
                          />
                        </View>

                        <View>
                          <Text style={styles.tokenName}>{token.label}</Text>
                          <Text style={styles.tokenSubtext}>{getTokenStatusText(token)}</Text>
                        </View>
                      </View>

                      <View style={styles.tokenValueWrap}>
                        <Text style={styles.tokenValue}>
                          {balanceLoading
                            ? 'Loading...'
                            : tokenBalances[token.key] !== null
                              ? tokenBalances[token.key]
                              : 'Unavailable'}
                        </Text>
                        <Text style={styles.tokenValueSymbol}>{token.symbol}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View>
                <Text style={styles.cardText}>
                  No wallet has been created yet for this account.
                </Text>

                <View style={styles.provisionRow}>
                  <Ionicons name="information-circle-outline" size={18} color={theme.accent} />
                  <Text style={styles.provisionText}>
                    You are signed in successfully. Tap the button below to create your embedded wallet.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.primaryButtonInline}
                onPress={walletReady ? handleWalletPress : handleCreateWallet}
              >
                <Text style={styles.primaryButtonText}>
                  {walletReady ? 'Receive / Wallet QR' : 'Create Wallet'}
                </Text>
              </TouchableOpacity>
            </View>

            {walletReady && (
              <View style={styles.savedWalletCard}>
                <Text style={styles.savedWalletTitle}>Collector Wallet Record</Text>

                {savedWalletLoading ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : savedWalletRecord ? (
                  <>
                    <Text style={styles.savedWalletText}>
                      Provider: {savedWalletRecord.wallet_provider}
                    </Text>
                    <Text style={styles.savedWalletText}>
                      Chain: {savedWalletRecord.chain_type}
                    </Text>
                    <Text style={styles.savedWalletText}>
                      Saved Email: {savedWalletRecord.email}
                    </Text>
                    <Text style={styles.savedWalletText}>
                      Last Seen:{' '}
                      {savedWalletRecord.last_seen_at
                        ? new Date(savedWalletRecord.last_seen_at).toLocaleString()
                        : '—'}
                    </Text>
                    <Text style={styles.savedWalletText}>
                      Created:{' '}
                      {savedWalletRecord.created_at
                        ? new Date(savedWalletRecord.created_at).toLocaleString()
                        : '—'}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.savedWalletText}>
                    No saved wallet record found yet.
                  </Text>
                )}
              </View>
            )}

            {walletReady && (
              <View style={styles.walletActionRow}>
                <TouchableOpacity
                  style={styles.secondaryButtonInlineWide}
                  onPress={handleCopyAddress}
                >
                  <Text style={styles.secondaryButtonText}>Copy Address</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButtonInlineWide}
                  onPress={handleOpenBaseScan}
                >
                  <Text style={styles.secondaryButtonText}>Open BaseScan</Text>
                </TouchableOpacity>
              </View>
            )}

            {walletReady && (
              <View style={styles.walletActionRow}>
                <TouchableOpacity
                  style={styles.secondaryButtonInlineWide}
                  onPress={handleOpenSend}
                >
                  <Text style={styles.secondaryButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            )}

            {lastTxHash && walletReady && (
              <View style={styles.lastTxCard}>
                <View style={styles.lastTxHeader}>
                  <View style={styles.lastTxBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#6ECF8E" />
                    <Text style={styles.lastTxBadgeText}>Last submitted tx</Text>
                  </View>
                </View>

                <Text style={styles.lastTxHash}>{truncateHash(lastTxHash)}</Text>

                <View style={styles.lastTxActions}>
                  <TouchableOpacity
                    style={styles.lastTxActionButton}
                    onPress={handleCopyTxHash}
                  >
                    <Text style={styles.lastTxActionText}>Copy Hash</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.lastTxActionButton}
                    onPress={() => handleOpenTxHash(lastTxHash)}
                  >
                    <Text style={styles.lastTxActionText}>View Tx</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {walletReady && (
            <View style={styles.card}>
              <View style={styles.row}>
                <Ionicons name="time-outline" size={22} color={theme.accent} />
                <Text style={styles.cardTitle}>Recent Activity</Text>
              </View>

              {txHistoryLoading ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : txHistoryError ? (
                <Text style={styles.cardText}>{txHistoryError}</Text>
              ) : txHistory.length === 0 ? (
                <Text style={styles.cardText}>No recent transfers found yet.</Text>
              ) : (
                <View style={styles.historyList}>
                  {txHistory.map((item) => {
                    const matchingToken =
                      TOKEN_OPTIONS.find((token) => token.symbol === item.asset) || null;

                    const accent = matchingToken?.accent || theme.accent;
                    const historyIconSource = matchingToken?.icon || null;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.historyRow}
                        onPress={() => handleOpenTxHash(item.hash)}
                      >
                        <View style={styles.historyLeft}>
                          <View
                            style={[
                              styles.historyIcon,
                              {
                                backgroundColor:
                                  item.direction === 'sent' ? '#FFEDEE' : '#EEF8F1',
                                borderColor:
                                  item.direction === 'sent' ? '#F4C2C5' : '#CDE7D4',
                              },
                            ]}
                          >
                            <Ionicons
                              name={
                                item.direction === 'sent'
                                  ? 'arrow-up-outline'
                                  : 'arrow-down-outline'
                              }
                              size={16}
                              color={item.direction === 'sent' ? '#D65A67' : '#3AA76D'}
                            />
                          </View>

                          <View
                            style={[
                              styles.historyTokenBadge,
                              { backgroundColor: `${accent}22`, borderColor: `${accent}55` },
                            ]}
                          >
                            {historyIconSource ? (
                              <Image
                                source={historyIconSource}
                                style={styles.historyTokenImage}
                                resizeMode="contain"
                              />
                            ) : (
                              <Text style={[styles.historyTokenBadgeText, { color: accent }]}>
                                {item.asset.slice(0, 1)}
                              </Text>
                            )}
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyTitle}>
                              {item.direction === 'sent' ? 'Sent' : 'Received'} {item.asset}
                            </Text>
                            <Text style={styles.historySubtitle}>
                              {item.direction === 'sent'
                                ? `To ${formatShortAddress(item.to)}`
                                : `From ${formatShortAddress(item.from)}`}
                            </Text>
                            <Text style={styles.historyDate}>
                              {formatHistoryDate(item.timestamp)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.historyRight}>
                          <Text
                            style={[
                              styles.historyAmount,
                              {
                                color:
                                  item.direction === 'sent' ? '#D65A67' : '#3AA76D',
                              },
                            ]}
                          >
                            {item.direction === 'sent' ? '-' : '+'}
                            {formatHistoryAmount(item.value)}
                          </Text>
                          <Text style={styles.historyAsset}>{item.asset}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="gift-outline" size={22} color={theme.accent} />
              <Text style={styles.cardTitle}>JGA_STUDIO Rewards</Text>
            </View>

            {rewardsLoading ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <>
                <View style={styles.rewardsHero}>
                  <Text style={styles.rewardsHeroLabel}>Claimable Rewards</Text>
                  <Text style={styles.rewardsHeroValue}>
                    {claimableRewardTotal.toFixed(2)} JGA_STUDIO
                  </Text>
                </View>

                <View style={styles.rewardsStatsRow}>
                  <View style={styles.rewardsStatPill}>
                    <Text style={styles.rewardsStatLabel}>Claimable Events</Text>
                    <Text style={styles.rewardsStatValue}>
                      {claimableRewardEvents.length}
                    </Text>
                  </View>

                  <View style={styles.rewardsStatPill}>
                    <Text style={styles.rewardsStatLabel}>Claimed Events</Text>
                    <Text style={styles.rewardsStatValue}>
                      {claimedRewardEvents.length}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardText}>
                  Purchases earn 5% of the artwork purchase amount in JGA_STUDIO. Rewards accrue first and will be distributed from the treasury wallet when claimed.
                </Text>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    claimableRewardTotal <= 0 && { opacity: 0.6 },
                  ]}
                  onPress={handleClaimRewards}
                  disabled={claimableRewardTotal <= 0}
                >
                  <Text style={styles.primaryButtonText}>Claim Rewards</Text>
                </TouchableOpacity>

                <View style={styles.rewardHistoryCard}>
                  <Text style={styles.rewardHistoryTitle}>Recent Reward Events</Text>

                  {rewardEvents.length === 0 ? (
                    <Text style={styles.rewardHistoryText}>
                      No reward activity yet.
                    </Text>
                  ) : (
                    rewardEvents.slice(0, 3).map((event) => (
                      <View key={event.id} style={styles.rewardHistoryRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rewardHistoryAmount}>
                            {Number(event.reward_amount).toFixed(2)} {event.token_symbol}
                          </Text>
                          <Text style={styles.rewardHistoryText}>
                            {event.reward_formula || 'Reward event'}
                          </Text>
                        </View>
                        <Text style={styles.rewardStatusText}>{event.status}</Text>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </View>
        </Section>

        {isSignedIn && (
          <StudioCatalogManager
            getAccessToken={getAccessToken}
            onAuthorizationChange={setIsAdmin}
          />
        )}

        <Section title="My Collection">
          {wishlist.length === 0 ? (
            <Empty text="No collected works yet" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {wishlist.map((item) => (
                <Image
                  key={item.id}
                  source={{ uri: item.image_url }}
                  style={styles.collectionImage}
                />
              ))}
            </ScrollView>
          )}
        </Section>

        <Section title="Wishlist">
          {wishlist.length === 0 ? (
            <Empty text="No saved artworks yet" />
          ) : (
            wishlist.map((item) => (
              <View key={item.id} style={styles.wishlistItem}>
                <Image source={{ uri: item.image_url }} style={styles.wishlistImage} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.wishlistTitle}>{item.title}</Text>
                  <Text style={styles.wishlistPrice}>${item.price_usd}</Text>
                </View>
                <TouchableOpacity onPress={() => removeFromWishlist(item.id)}>
                  <Ionicons name="trash-outline" size={22} color="#ff4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </Section>

        <Section title="Collector Tools">
          <Setting icon="card-outline" text="Saved Payments" />
          <Setting icon="notifications-outline" text="Notifications" />
          <Setting icon="hammer-outline" text="My Bids & Auctions" />
        </Section>

        <Section title="Settings">
          <View style={styles.settingRow}>
            <Ionicons name="moon-outline" size={22} color={theme.text} />
            <Text style={styles.settingText}>Dark Mode</Text>
            <Switch value={theme.isDark} onValueChange={theme.toggleDarkMode} />
          </View>

          <Setting icon="document-text-outline" text="Legal" />
        </Section>

        {isSignedIn && (
          <TouchableOpacity style={styles.signOut} onPress={handleLogout}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={receiveModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReceiveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receive</Text>
              <TouchableOpacity onPress={() => setReceiveModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {!!walletAddress && (
              <>
                <View style={styles.qrOuter}>
                  <View style={styles.qrInner}>
                    <QRCodeStyled
                      data={walletAddress || ''}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 20,
                        padding: 20,
                      }}
                      padding={20}
                      pieceSize={8}
                      pieceBorderRadius={4}
                      color="#111111"
                    />
                  </View>
                </View>

                <Text style={styles.receiveHelp}>
                  Scan this QR code or copy the address below to receive funds on Base.
                </Text>

                <Text style={styles.fullAddress}>{walletAddress}</Text>

                <TouchableOpacity style={styles.primaryButton} onPress={handleCopyAddress}>
                  <Text style={styles.primaryButtonText}>Copy Wallet Address</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleOpenBaseScan}
                >
                  <Text style={styles.secondaryButtonText}>Open in BaseScan</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={sendModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSendModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send on Base</Text>
              <TouchableOpacity onPress={() => setSendModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.sendTokenPanel}>
              <Text style={styles.sendLabel}>Select Token</Text>

              <View style={styles.segmentedWrap}>
                {TOKEN_OPTIONS.map((token) => {
                  const selected = selectedSendToken === token.key;

                  return (
                    <TouchableOpacity
                      key={token.key}
                      style={[
                        styles.segmentedChip,
                        selected && styles.segmentedChipActive,
                      ]}
                      onPress={() => setSelectedSendToken(token.key)}
                    >
                      <View
                        style={[
                          styles.segmentedTokenBadge,
                          {
                            backgroundColor: selected
                              ? 'rgba(255,255,255,0.2)'
                              : `${token.accent}22`,
                            borderColor: selected
                              ? 'rgba(255,255,255,0.25)'
                              : `${token.accent}55`,
                          },
                        ]}
                      >
                        <Image
                          source={token.icon}
                          style={styles.segmentedTokenImage}
                          resizeMode="contain"
                        />
                      </View>

                      <Text
                        style={[
                          styles.segmentedChipText,
                          selected && styles.segmentedChipTextActive,
                        ]}
                      >
                        {token.symbol}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.selectedBalanceCard}>
                <View style={styles.selectedBalanceHeader}>
                  <Text style={styles.selectedBalanceLabel}>Available</Text>
                  <Text style={styles.selectedBalanceToken}>
                    {selectedTokenConfig.label}
                  </Text>
                </View>

                <Text style={styles.selectedBalanceValue}>
                  {selectedTokenBalance !== null
                    ? `${selectedTokenBalance} ${selectedTokenConfig.symbol}`
                    : balanceLoading
                      ? 'Loading...'
                      : 'Unavailable'}
                </Text>

                <Text style={styles.selectedBalanceSubtext}>
                  {selectedTokenConfig.type === 'native'
                    ? 'Native transfer routed through eth_sendTransaction.'
                    : 'ERC-20 transfer routed through token contract transfer(address,uint256).'}
                </Text>
              </View>
            </View>

            <Text style={styles.sendLabel}>Recipient Address</Text>
            <View style={styles.recipientInputRow}>
              <TextInput
                value={sendTo}
                onChangeText={setSendTo}
                placeholder="0x..."
                placeholderTextColor={theme.isDark ? '#8f8f8f' : '#8a8a8a'}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.recipientInput}
              />

              <TouchableOpacity
                style={styles.qrScanButton}
                onPress={handleOpenQrScanner}
              >
                <Ionicons name="scan-outline" size={22} color={theme.accent} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sendLabel}>Amount ({selectedTokenConfig.symbol})</Text>
            <TextInput
              value={sendAmount}
              onChangeText={setSendAmount}
              placeholder={selectedTokenConfig.symbol === 'USDC' ? '1.00' : '0.001'}
              placeholderTextColor={theme.isDark ? '#8f8f8f' : '#8a8a8a'}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <View style={styles.sendPreviewCard}>
              <Text style={styles.sendPreviewTitle}>Transaction Preview</Text>
              <Text style={styles.sendPreviewValue}>
                {formatTokenInputForPreview(sendAmount)} {selectedTokenConfig.symbol}
              </Text>
              <Text style={styles.sendPreviewSubtext}>
                {sendTo.trim()
                  ? `To ${sendTo.slice(0, 6)}...${sendTo.slice(-4)}`
                  : 'Enter a recipient address to preview the transfer.'}
              </Text>
            </View>

            {lastTxHash ? (
              <View style={styles.modalTxCard}>
                <View style={styles.modalTxRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#6ECF8E" />
                  <Text style={styles.modalTxTitle}>Most recent tx</Text>
                </View>
                <Text style={styles.modalTxHash}>{truncateHash(lastTxHash)}</Text>
              </View>
            ) : null}

            <Text style={styles.sendHelp}>
              {selectedTokenConfig.type === 'native'
                ? 'This sends Base ETH from your embedded wallet on Base Mainnet.'
                : `This sends ${selectedTokenConfig.symbol} from your embedded wallet using the token contract on Base.`}
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, sendLoading && { opacity: 0.7 }]}
              onPress={handleSendTransaction}
              disabled={sendLoading}
            >
              {sendLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Confirm & Send {selectedTokenConfig.symbol}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={qrScannerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setQrScannerVisible(false);
          setHasScannedQr(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scan Wallet QR</Text>
              <TouchableOpacity
                onPress={() => {
                  setQrScannerVisible(false);
                  setHasScannedQr(false);
                }}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.receiveHelp}>
              Scan a wallet QR code to fill the recipient address automatically.
            </Text>

            <View style={styles.qrScannerFrame}>
              <CameraView
                style={styles.qrScannerCamera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={hasScannedQr ? undefined : handleQrScanned}
              />
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setQrScannerVisible(false);
                setHasScannedQr(false);
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Section({ title, children }: any) {
  const theme = useTheme();

  return (
    <View style={{ paddingHorizontal: 18, marginTop: 30 }}>
      <Text
        style={{
          color: theme.text,
          fontSize: 20,
          fontWeight: '700',
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Setting({ icon, text }: any) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={() => Alert.alert(text, 'Coming soon')}
    >
      <Ionicons name={icon as any} size={22} color={theme.text} />
      <Text style={styles.settingText}>{text}</Text>
    </TouchableOpacity>
  );
}

function Empty({ text }: any) {
  const theme = useTheme();

  return (
    <Text
      style={{
        color: theme.text,
        opacity: 0.6,
        textAlign: 'center',
        marginVertical: 20,
      }}
    >
      {text}
    </Text>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },

    loadingContainer: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },

    loadingText: {
      color: theme.text,
      marginTop: 12,
      fontSize: 16,
    },

    header: {
      alignItems: 'center',
      paddingTop: Platform.OS === 'ios' ? 60 : 30,
      paddingBottom: 20,
    },

    avatar: {
      width: 90,
      height: 90,
      borderRadius: 45,
      marginBottom: 12,
    },

    name: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
    },

    role: {
      fontSize: 15,
      color: theme.text,
      opacity: 0.7,
      marginBottom: 12,
      textAlign: 'center',
    },

    badgeRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },

    tierBadge: {
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },

    tierText: {
      color: theme.accent,
      fontWeight: '600',
      fontSize: 13,
    },

    walletBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
    },

    walletBadgeText: {
      color: theme.text,
      fontWeight: '600',
      fontSize: 13,
    },

    adminBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },

    adminBadgeText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },

    card: {
      backgroundColor: theme.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },

    cardTitle: {
      color: theme.text,
      fontWeight: '700',
      marginLeft: 8,
      fontSize: 16,
    },

    cardText: {
      color: theme.text,
      opacity: 0.75,
      marginBottom: 12,
      lineHeight: 21,
    },

    tokenPortfolioCard: {
      backgroundColor: theme.isDark ? '#2A2236' : '#F7F2FF',
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    },

    portfolioHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },

    portfolioTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },

    refreshPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.card,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: theme.border,
    },

    refreshPillText: {
      color: theme.accent,
      fontWeight: '700',
      fontSize: 12,
    },

    tokenRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },

    tokenLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 10,
    },

    tokenIconBubble: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      borderWidth: 1,
      overflow: 'hidden',
    },

    tokenIconImage: {
      width: 20,
      height: 20,
    },

    tokenName: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 14,
    },

    tokenSubtext: {
      color: theme.text,
      opacity: 0.65,
      fontSize: 12,
      marginTop: 2,
    },

    tokenValueWrap: {
      alignItems: 'flex-end',
      maxWidth: '45%',
    },

    tokenValue: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 15,
      textAlign: 'right',
    },

    tokenValueSymbol: {
      color: theme.text,
      opacity: 0.65,
      fontSize: 12,
      marginTop: 2,
    },

    savedWalletCard: {
      backgroundColor: theme.isDark ? '#2A2236' : '#F7F2FF',
      borderRadius: 14,
      padding: 14,
      marginTop: 8,
      marginBottom: 12,
    },

    savedWalletTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 8,
    },

    savedWalletText: {
      color: theme.text,
      opacity: 0.8,
      lineHeight: 22,
      fontSize: 14,
    },

    historyList: {
      marginTop: 4,
    },

    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },

    historyLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 12,
    },

    historyIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginRight: 8,
    },

    historyTokenBadge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginRight: 10,
      overflow: 'hidden',
    },

    historyTokenBadgeText: {
      fontWeight: '700',
      fontSize: 12,
    },

    historyTokenImage: {
      width: 16,
      height: 16,
    },

    historyTitle: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 14,
    },

    historySubtitle: {
      color: theme.text,
      opacity: 0.7,
      fontSize: 12,
      marginTop: 2,
    },

    historyDate: {
      color: theme.text,
      opacity: 0.55,
      fontSize: 11,
      marginTop: 2,
    },

    historyRight: {
      alignItems: 'flex-end',
    },

    historyAmount: {
      fontWeight: '700',
      fontSize: 14,
    },

    historyAsset: {
      color: theme.text,
      opacity: 0.65,
      fontSize: 12,
      marginTop: 2,
    },

    rewardsHero: {
      backgroundColor: theme.isDark ? '#2A2236' : '#F7F2FF',
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
    },

    rewardsHeroLabel: {
      color: theme.text,
      opacity: 0.7,
      marginBottom: 6,
      fontSize: 13,
      fontWeight: '600',
    },

    rewardsHeroValue: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '700',
    },

    rewardsStatsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },

    rewardsStatPill: {
      flex: 1,
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
      borderRadius: 12,
      padding: 12,
    },

    rewardsStatLabel: {
      color: theme.text,
      opacity: 0.7,
      fontSize: 12,
      marginBottom: 4,
    },

    rewardsStatValue: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },

    rewardHistoryCard: {
      backgroundColor: theme.isDark ? '#2A2236' : '#F7F2FF',
      borderRadius: 14,
      padding: 14,
      marginTop: 12,
    },

    rewardHistoryTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 10,
    },

    rewardHistoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },

    rewardHistoryAmount: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 14,
      marginBottom: 2,
    },

    rewardHistoryText: {
      color: theme.text,
      opacity: 0.75,
      fontSize: 13,
    },

    rewardStatusText: {
      color: theme.accent,
      fontWeight: '700',
      fontSize: 12,
      textTransform: 'capitalize',
    },

    provisionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 10,
    },

    provisionText: {
      color: theme.text,
      opacity: 0.75,
      fontSize: 14,
      flex: 1,
    },

    input: {
      backgroundColor: theme.background,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 10,
    },

    sendLabel: {
      color: theme.text,
      fontWeight: '700',
      marginBottom: 8,
      marginTop: 4,
    },

    sendTokenPanel: {
      backgroundColor: theme.isDark ? '#201a29' : '#F7F2FF',
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },

    segmentedWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },

    segmentedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },

    segmentedChipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },

    segmentedTokenBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginRight: 8,
      overflow: 'hidden',
    },

    segmentedTokenImage: {
      width: 14,
      height: 14,
    },

    segmentedChipText: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 13,
    },

    segmentedChipTextActive: {
      color: '#fff',
    },

    selectedBalanceCard: {
      backgroundColor: theme.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },

    selectedBalanceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },

    selectedBalanceLabel: {
      color: theme.text,
      opacity: 0.7,
      fontSize: 13,
      fontWeight: '600',
    },

    selectedBalanceToken: {
      color: theme.accent,
      fontWeight: '700',
      fontSize: 12,
    },

    selectedBalanceValue: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 22,
      marginBottom: 4,
    },

    selectedBalanceSubtext: {
      color: theme.text,
      opacity: 0.7,
      fontSize: 12,
      lineHeight: 18,
    },

    recipientInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },

    recipientInput: {
      flex: 1,
      backgroundColor: theme.background,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },

    qrScanButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
      borderWidth: 1,
      borderColor: theme.border,
    },

    qrScannerFrame: {
      width: '100%',
      height: 320,
      overflow: 'hidden',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 14,
      backgroundColor: '#000',
    },

    qrScannerCamera: {
      flex: 1,
    },

    sendPreviewCard: {
      backgroundColor: theme.isDark ? '#2A2236' : '#F7F2FF',
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
    },

    sendPreviewTitle: {
      color: theme.text,
      opacity: 0.7,
      marginBottom: 6,
      fontSize: 13,
      fontWeight: '600',
    },

    sendPreviewValue: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 18,
      marginBottom: 4,
    },

    sendPreviewSubtext: {
      color: theme.text,
      opacity: 0.7,
      fontSize: 13,
      lineHeight: 18,
    },

    modalTxCard: {
      backgroundColor: theme.isDark ? '#1f2a22' : '#EFFAF2',
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.isDark ? '#35513d' : '#CFE6D5',
    },

    modalTxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },

    modalTxTitle: {
      color: theme.text,
      fontWeight: '700',
      marginLeft: 8,
      fontSize: 13,
    },

    modalTxHash: {
      color: theme.text,
      opacity: 0.8,
      fontSize: 13,
    },

    sendHelp: {
      color: theme.text,
      opacity: 0.7,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 14,
    },

    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },

    walletActionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },

    primaryButton: {
      backgroundColor: theme.accent,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },

    primaryButtonInline: {
      flex: 1,
      backgroundColor: theme.accent,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },

    primaryButtonText: {
      color: '#fff',
      fontWeight: '700',
    },

    secondaryButton: {
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 10,
    },

    secondaryButtonInlineWide: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: theme.isDark ? '#2A2236' : '#F1EAFE',
    },

    secondaryButtonText: {
      color: theme.accent,
      fontWeight: '700',
    },

    signOutInline: {
      marginTop: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },

    signOutInlineText: {
      color: '#ff4444',
      fontWeight: '700',
    },

    lastTxCard: {
      marginTop: 12,
      backgroundColor: theme.isDark ? '#1f2a22' : '#EFFAF2',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.isDark ? '#35513d' : '#CFE6D5',
    },

    lastTxHeader: {
      marginBottom: 8,
    },

    lastTxBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.card,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },

    lastTxBadgeText: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 12,
      marginLeft: 6,
    },

    lastTxHash: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 14,
      marginBottom: 10,
    },

    lastTxActions: {
      flexDirection: 'row',
      gap: 10,
    },

    lastTxActionButton: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },

    lastTxActionText: {
      color: theme.accent,
      fontWeight: '700',
      fontSize: 13,
    },

    collectionImage: {
      width: 120,
      height: 120,
      borderRadius: 16,
      marginRight: 12,
    },

    wishlistItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      padding: 12,
      borderRadius: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },

    wishlistImage: {
      width: 60,
      height: 60,
      borderRadius: 10,
      marginRight: 12,
    },

    wishlistTitle: {
      color: theme.text,
      fontWeight: '600',
    },

    wishlistPrice: {
      color: theme.accent,
      fontWeight: '700',
      marginTop: 4,
    },

    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },

    settingText: {
      flex: 1,
      marginLeft: 12,
      color: theme.text,
    },

    signOut: {
      marginHorizontal: 18,
      marginTop: 24,
      padding: 16,
      borderRadius: 18,
      backgroundColor: '#ff4444',
      alignItems: 'center',
    },

    signOutText: {
      color: '#fff',
      fontWeight: '700',
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: 20,
    },

    modalCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },

    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },

    modalTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '700',
    },

    qrOuter: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },

    qrInner: {
      width: 240,
      height: 240,
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
    },

    receiveHelp: {
      color: theme.text,
      opacity: 0.7,
      textAlign: 'center',
      marginBottom: 12,
      lineHeight: 20,
    },

    fullAddress: {
      color: theme.text,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 16,
    },
  });
