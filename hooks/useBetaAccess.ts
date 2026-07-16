import { useEffect, useState } from 'react';
import { usePrivy } from '../lib/privy';
import { supabase } from '../supabaseClient';

export function useBetaAccess() {
  const { user, isReady } = usePrivy();

  const [isBetaUser, setIsBetaUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!isReady) return;

      // Get email from Privy user
      const email = user?.linkedAccounts?.find(
        (a: any) => a.type === 'email'
      )?.address;

      // No email = no access
      if (!email) {
        setIsBetaUser(false);
        setLoading(false);
        return;
      }

      // 🔥 ADMIN BYPASS (you will always have access)
      const ADMIN_EMAIL = 'jgastudio2@gmail.com'; // ← replace with your real email

      if (email === ADMIN_EMAIL) {
        setIsBetaUser(true);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('beta_users')
          .select('*')
          .eq('email', email)
          .single();

        if (error) {
          console.log('Beta access check:', error.message);
          setIsBetaUser(false);
        } else {
          setIsBetaUser(!!data);
        }
      } catch (err) {
        console.error('Beta access error:', err);
        setIsBetaUser(false);
      }

      setLoading(false);
    };

    checkAccess();
  }, [user, isReady]);

  return { isBetaUser, loading };
}
