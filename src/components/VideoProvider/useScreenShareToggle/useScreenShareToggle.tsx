import { useState, useCallback, useRef } from 'react';
import { LogLevels, Track, Room, LocalAudioTrack, LocalVideoTrack, TrackPublication } from 'twilio-video';
import { ErrorCallback } from '../../../types';
import useLocalTracks from '../useLocalTracks/useLocalTracks';
import {
  SubscribeRulesInstance,
  SubscribeRulesList,
  SubscribeRulesPage,
} from 'twilio/lib/rest/video/v1/room/roomParticipant/roomParticipantSubscribeRule';
import { collapseTextChangeRangesAcrossMultipleVersions } from 'typescript';
import { time } from 'console';
import { forEach } from 'lodash';

interface MediaStreamTrackPublishOptions {
  name?: string;
  priority: Track.Priority;
  logLevel: LogLevels;
}

export default function useScreenShareToggle(room: Room | null, onError: ErrorCallback) {
  const [isSharing, setIsSharing] = useState(false);
  const stopScreenShareRef = useRef<() => void>(null!);

  // todo : Self screenshare duplicates during some cases, and audio duplicates with it. But it only appears so on the screensharer's side. The other participants see it fine.
  // Audio duplication seems to fix itself when sharing again.

  const shareScreen = useCallback(() => {
    navigator.mediaDevices
      .getDisplayMedia({
        audio: true,
        video: true,
      })
      .then(stream => {
        var hasMic = false;
        var mictrack: any;
        var screenShareTrackBool = false;
        var screenShareAudioTrack: any;
        var avaliableTracks = stream.getTracks();

        // Check if screen share has audio track selected
        if (stream.getAudioTracks().length > 0) {
          screenShareAudioTrack = stream.getAudioTracks()[0];
          console.log(screenShareAudioTrack);
          screenShareTrackBool = true;
        }

        // Check if we have a mic track, and if we do remove it IF screen share has audio track
        var mediaTrack = room!.localParticipant.tracks;
        mediaTrack.forEach(element => {
          if (element.kind === 'audio') {
            mictrack = element.track;
            hasMic = true;
            if (screenShareAudioTrack) {
              room!.localParticipant.unpublishTrack(element.track);
            }
          }
        });

        // If we have a mic/screen track then mix them together and replace stream
        if (hasMic && screenShareTrackBool) {
          var finalStream: any;
          avaliableTracks.forEach(track => {
            if (track.kind === 'video' && track instanceof MediaStreamTrack) {
              finalStream = mixAudioTracksTogether(screenShareAudioTrack, mictrack.mediaStreamTrack);
              finalStream.addTrack(track);
              stream = finalStream;
            }
          });
        }

        // if mic doesnt get modified then it does not appear on stream.getTracks() only the screen share track
        var tracks = stream.getTracks();

        tracks.forEach(track => {
          var trackName = track.kind === 'video' ? 'screen' : 'screen_audio';

          room!.localParticipant
            .publishTrack(track, {
              name: trackName,
              priority: 'low', // Priority is set to high by the subscriber when the video track is rendered
            } as MediaStreamTrackPublishOptions)
            .then(trackPublication => {
              stopScreenShareRef.current = () => {
                tracks.forEach(ctrack => {
                  room!.localParticipant.unpublishTrack(ctrack);
                  room!.localParticipant.emit('trackUnpublished', trackPublication);
                  ctrack.stop();
                  setIsSharing(false);
                  // get user microphone if room has no audio track
                  if (room!.localParticipant.audioTracks.size === 0) {
                    // the promise might be breakin the room size check logging so it could be checked while testing (should be 1 always)
                    console.log(room!.localParticipant.audioTracks.size);
                    getUserMicrophone(room!);
                  }
                });
              };
              track.onended = stopScreenShareRef.current;
              setIsSharing(true);
            })
            .catch(onError);
          //}
        });
      })
      .catch(error => {
        // Don't display an error if the user closes the screen share dialog
        if (
          error.message === 'Permission denied by system' ||
          (error.name !== 'AbortError' && error.name !== 'NotAllowedError')
        ) {
          console.error(error);
          onError(error);
        }
      });
  }, [room, onError]);

  const toggleScreenShare = useCallback(() => {
    if (room) {
      // stop sharing all tracks if already sharing screen
      !isSharing ? shareScreen() : stopScreenShareRef.current();
    }
  }, [isSharing, shareScreen, room]);

  return [isSharing, toggleScreenShare] as const;
}

function mixAudioTracksTogether(stream1: MediaStreamTrack, stream2: MediaStreamTrack) {
  var OutgoingAudioMediaStream = new MediaStream();
  OutgoingAudioMediaStream.addTrack(stream1);

  var IncomingAudioMediaStream = new MediaStream();
  IncomingAudioMediaStream.addTrack(stream2);

  const audioContext = new AudioContext();

  var audioIn_01 = audioContext.createMediaStreamSource(OutgoingAudioMediaStream);
  var audioIn_02 = audioContext.createMediaStreamSource(IncomingAudioMediaStream);

  var dest = audioContext.createMediaStreamDestination();

  audioIn_01.connect(dest);
  audioIn_02.connect(dest);

  var FinalStream = dest.stream;

  return FinalStream;
}

function getUserMicrophone(room: Room) {
  // get avaliable input device with id = "default" and kind = "audioinput" and add it to the stream and add it to the room
  var userMic: any;
  navigator.mediaDevices.enumerateDevices().then(devices => {
    devices.forEach(device => {
      if (device.kind === 'audioinput' && device.deviceId === 'default') {
        navigator.mediaDevices
          .getUserMedia({
            audio: {
              deviceId: device.deviceId,
            },
          })
          .then(stream => {
            userMic = stream.getAudioTracks()[0];
            room!.localParticipant.publishTrack(userMic);
          });
      }
    });
  });
}
