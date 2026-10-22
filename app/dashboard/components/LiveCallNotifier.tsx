'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { TranslatedText } from '@/app/components/TranslatedText';
import { useAuthToken } from '@/lib/auth-token-context';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export default function LiveCallNotifier() {
  const token = useAuthToken();
  const router = useRouter();
  const pathname = usePathname();
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  };

  useEffect(() => {
    if (pathname && pathname.includes('/video-call/')) {
      stopAudio();
      toast.dismiss('active-call-notification');
      setActiveCallId(null);
    }
  }, [pathname]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const checkActiveCalls = async () => {
      try {
        const response = await fetchWithAuth('/api/calls/check-active', token);
        const data = await response.json();

        if (data.active && data.calls && data.calls.length > 0) {
          const call = data.calls[0]; // Take the first active call
          
          if (call.aid !== activeCallId) {
            setActiveCallId(call.aid);
            
            // Play notification sound in loop
            stopAudio();
            const audio = new Audio('/sounds/ringtone.mp3?v=2');
            audio.loop = true;
            audioRef.current = audio;
            audio.play().catch(e => console.log('Audio play failed', e));

            toast.custom((t) => (
              <div
                className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-[min(90vw,28rem)] w-full bg-white shadow-lg rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
              >
                <div className="flex-1 w-0 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center animate-pulse">
                         <Video className="h-6 w-6 text-primary-600" />
                      </div>
                    </div>
                    <div className="ml-3 flex-1">
                      <TranslatedText as="p" className="text-sm font-medium text-forest-900">
                        Incoming Video Call
                      </TranslatedText>
                      <TranslatedText as="p" className="mt-1 text-sm text-forest-500">
                        Your doctor is calling you to join the session.
                      </TranslatedText>
                    </div>
                  </div>
                </div>
                <div className="flex border-l border-sage-200">
                  <button
                    onClick={() => {
                      stopAudio();
                      toast.dismiss(t.id);
                      router.push(`/dashboard/video-call/${call.aid}`);
                    }}
                    className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-bold text-primary-600 hover:text-primary-500 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <TranslatedText>Join Now</TranslatedText>
                  </button>
                </div>
              </div>
            ), {
              duration: Infinity,
              id: 'active-call-notification',
              position: 'top-right',
            });
          }
        } else {
             // If no active calls, dismiss notification and stop audio
             if (activeCallId) {
                 stopAudio();
                 toast.dismiss('active-call-notification');
                 setActiveCallId(null);
             }
        }
      } catch (error) {
        console.error('Error checking active calls:', error);
      }
    };

    // Initial check
    checkActiveCalls();

    // Poll every 5 seconds
    pollInterval = setInterval(checkActiveCalls, 5000);

    return () => {
      clearInterval(pollInterval);
      stopAudio();
      toast.dismiss('active-call-notification');
    };
  }, [activeCallId, router, token]);

  return null;
}
