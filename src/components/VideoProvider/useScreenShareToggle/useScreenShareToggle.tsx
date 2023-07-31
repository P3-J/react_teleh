import { useState, useCallback, useRef } from 'react';
import {
  LogLevels,
  Track,
  Room,
  LocalAudioTrack,
  LocalVideoTrack,
  TrackPublication,
  LocalParticipant,
  LocalTrackPublication,
} from 'twilio-video';
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

        // Check if screen share has audio track selected
        if (stream.getAudioTracks().length > 0) {
          screenShareAudioTrack = stream.getAudioTracks()[0];
          //console.log(screenShareAudioTrack);
          screenShareTrackBool = true;
        }

        // Check if we have a mic track, and if we do remove it IF screen share has audio track
        var mediaTrack = room!.localParticipant.tracks;
        mediaTrack.forEach(element => {
          if (element.kind === 'audio') {
            mictrack = element.track;
            hasMic = true;
            if (screenShareTrackBool) {
              room!.localParticipant.unpublishTrack(element.track);
              room!.localParticipant.emit('trackUnpublished', element);
              stream.getAudioTracks().forEach(track => {
                // if track audio then stop it
                if (track.kind === 'audio') {
                  track.stop();
                }
              });
            }
          }
        });

        var avaliableTracks = stream.getTracks();
        console.log('siin - ' + avaliableTracks);
        console.log(room!.localParticipant.tracks);
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
          console.log(tracks, room!.localParticipant.tracks);
          var trackName = track.kind === 'video' ? 'screen' : 'screen_audio';

          room!.localParticipant
            .publishTrack(track, {
              name: trackName,
              priority: 'low', // Priority is set to high by the subscriber when the video track is rendered
            } as MediaStreamTrackPublishOptions)
            .then(trackPublication => {
              // if the user stops sharing unpublish all audio tracks and publish the mic track again
              //stream = oldStreamWithMic;
              // bad fix but it works, idk why
              console.log('starting with ', room!.localParticipant.tracks);

              stopScreenShareRef.current = () => {
                // remove all local participant audio tracks
                // need to unpublish all tracks then home free. Do same as stop sharing button in navigator.mediadevices
                // something releated to the fact that audio is not unpublished

                room!.localParticipant.audioTracks.forEach(publication => {
                  if (screenShareTrackBool) {
                    room!.localParticipant.unpublishTrack(publication.track);
                    room!.localParticipant.emit('trackUnpublished', publication);
                    publication.track.stop();
                    room!.localParticipant.unpublishTrack(publication.track);
                  }
                });

                room!.localParticipant.videoTracks.forEach(publication => {
                  if (publication.track.name === 'screen') {
                    room!.localParticipant.unpublishTrack(publication.track);
                    room!.localParticipant.emit('trackUnpublished', publication);
                    publication.track.stop();
                  }
                });

                room!.localParticipant.publishTrack(mictrack);

                setIsSharing(false);
              };
              track.onended = stopScreenShareRef.current;
              setIsSharing(true);

              //console.log(isSharing)
            })
            .catch(onError);
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
