let expoAudio: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  expoAudio = require('expo-audio');
} catch (e) {
  console.warn('[CallSoundService] expo-audio module not available', e);
}

class CallSoundService {
  private ringPlayer: any = null;
  private chimePlayer: any = null;
  private audioModeReady: Promise<void> | null = null;
  private moduleWarningShown = false;
  private isRinging: boolean = false;

  private ensureAudioMode(): Promise<void> {
    if (!expoAudio?.setAudioModeAsync) return Promise.resolve();
    if (!this.audioModeReady) {
      this.audioModeReady = Promise.resolve(
        expoAudio.setAudioModeAsync({ playsInSilentMode: true })
      ).catch((err) => {
        console.warn('[CallSoundService] Failed to configure audio mode:', err);
      });
    }
    return this.audioModeReady;
  }

  async startWaitingRing() {
    if (this.isRinging || this.ringPlayer?.playing) return;

    if (!expoAudio?.createAudioPlayer) {
      if (!this.moduleWarningShown) {
        this.moduleWarningShown = true;
        console.warn(
          '[CallSoundService] expo-audio native module is unavailable, so the call ringtone cannot play. Rebuild the development client with `npx expo run:android` (or `npx expo run:ios`).'
        );
      }
      return;
    }

    try {
      await this.ensureAudioMode();
      if (!this.ringPlayer) {
        this.ringPlayer = expoAudio.createAudioPlayer(
          require('../../assets/sounds/call_ringing.wav')
        );
      }
      // createAudioPlayer options do not include loop; it is an AudioPlayer property.
      this.ringPlayer.loop = true;
      this.ringPlayer.volume = 1;
      this.ringPlayer.play();
      this.isRinging = true;
    } catch (err) {
      this.isRinging = false;
      console.warn('[CallSoundService] Failed to play waiting ring:', err);
    }
  }

  async stopWaitingRing() {
    this.isRinging = false;
    try {
      if (this.ringPlayer?.pause) {
        this.ringPlayer.pause();
      }
      if (this.ringPlayer?.seekTo) {
        this.ringPlayer.seekTo(0);
      }
    } catch (err) {
      console.warn('[CallSoundService] Failed to stop waiting ring:', err);
    }
  }

  async playJoinChime() {
    // When someone joins, immediately stop the ringtone and play the pleasant chime
    await this.stopWaitingRing();

    try {
      if (expoAudio?.createAudioPlayer) {
        if (!this.chimePlayer) {
          this.chimePlayer = expoAudio.createAudioPlayer(
            require('../../assets/sounds/join_chime.wav')
          );
        } else if (this.chimePlayer?.seekTo) {
          this.chimePlayer.seekTo(0);
        }
        if (this.chimePlayer?.play) {
          this.chimePlayer.play();
        }
      }
    } catch (err) {
      console.warn('[CallSoundService] Failed to play join chime:', err);
    }
  }

  async cleanup() {
    await this.stopWaitingRing();
    try {
      if (this.ringPlayer?.release) {
        this.ringPlayer.release();
        this.ringPlayer = null;
      }
      if (this.chimePlayer?.release) {
        this.chimePlayer.release();
        this.chimePlayer = null;
      }
    } catch {
      // Ignored during unmount
    }
  }
}

export const callSoundService = new CallSoundService();
