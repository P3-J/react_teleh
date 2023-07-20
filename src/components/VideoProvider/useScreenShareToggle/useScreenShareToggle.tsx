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

interface MediaStreamTrackPublishOptions {
  name?: string;
  priority: Track.Priority;
  logLevel: LogLevels;
}

export default function useScreenShareToggle(room: Room | null, onError: ErrorCallback) {
  const [isSharing, setIsSharing] = useState(false);
  const stopScreenShareRef = useRef<() => void>(null!);

  //const ds = navigator.mediaDevices.getDisplayMedia({audio: true, video: true})
  //console.log(ds)

  const shareScreen = useCallback(() => {
    navigator.mediaDevices
      .getDisplayMedia({
        audio: true,
        video: true,
      })
      .then(stream => {
        //remove local microphone track
        //room!.localParticipant.unpublishTrack(room!.localParticipant.getaudioTracks[0].track);

        var micTrack = room!.localParticipant.tracks;
        var mictrack: any;
        micTrack.forEach(element => {
          mictrack = element.track;
          //remove mictrack
          room!.localParticipant.unpublishTrack(element.track);
        });
        const audioTrack = mictrack.mediaStreamTrack;
        const otherTrack = stream.getAudioTracks()[0];
        debugger;

        var OutgoingAudioMediaStream = new MediaStream();
        OutgoingAudioMediaStream.addTrack(otherTrack);

        var IncomingAudioMediaStream = new MediaStream();
        IncomingAudioMediaStream.addTrack(audioTrack);

        const audioContext = new AudioContext();

        var audioIn_01 = audioContext.createMediaStreamSource(OutgoingAudioMediaStream);
        var audioIn_02 = audioContext.createMediaStreamSource(IncomingAudioMediaStream);

        var dest = audioContext.createMediaStreamDestination();

        audioIn_01.connect(dest);
        audioIn_02.connect(dest);

        var FinalStream = dest.stream;
        stream = FinalStream;

        //stream.addTrack(audioTrack);
        var tracks = stream.getTracks();

        tracks.forEach(track => {
          room!.localParticipant
            .publishTrack(track, {
              name: track.kind + '-' + track.id,
              priority: 'low', // Priority is set to high by the subscriber when the video track is rendered
            } as MediaStreamTrackPublishOptions)
            .then(trackPublication => {
              stopScreenShareRef.current = () => {
                room!.localParticipant.unpublishTrack(track);
                // TODO: remove this if the SDK is updated to emit this event
                room!.localParticipant.emit('trackUnpublished', trackPublication);
                track.stop();
                setIsSharing(false);
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
      !isSharing ? shareScreen() : stopScreenShareRef.current();
    }
  }, [isSharing, shareScreen, room]);

  return [isSharing, toggleScreenShare] as const;
}
