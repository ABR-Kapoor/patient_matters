import { Platform } from 'react-native';

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
  private isRinging: boolean = false;

  async startWaitingRing() {
    if (this.isRinging) return;
    this.isRinging = true;

    try {
      if (expoAudio?.createAudioPlayer) {
        if (!this.ringPlayer) {
          this.ringPlayer = expoAudio.createAudioPlayer(
            require('../../assets/sounds/call_ringing.wav'),
            { loop: true }
          );
        }
        if (this.ringPlayer?.play) {
          this.ringPlayer.play();
        }
      }
    } catch (err) {
      console.warn('[CallSoundService] Failed to play waiting ring:', err);
    }
  }

  async stopWaitingRing() {
    this.isRinging = false;
    try {
      if (this.ringPlayer?.pause) {
        this.ringPlayer.pause();
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
            require('../../assets/sounds/join_chime.wav'),
            { loop: false }
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
