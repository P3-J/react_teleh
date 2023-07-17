import { useState, useCallback, useRef } from 'react';
import { LogLevels, Track, Room } from 'twilio-video';
import { ErrorCallback } from '../../../types';
import useLocalTracks from '../useLocalTracks/useLocalTracks';

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
        //const track = stream.getTracks()[0];
        const tracks = stream.getTracks();

        tracks.forEach(track => {
          var streamName = track.kind;

          room!.localParticipant
            .publishTrack(track, {
              name: streamName, // Tracks can be named to easily find them later
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
