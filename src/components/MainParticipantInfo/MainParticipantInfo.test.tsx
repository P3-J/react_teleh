import React from 'react';
import MainParticipantInfo from './MainParticipantInfo';
import { shallow } from 'enzyme';
import usePublications from '../../hooks/usePublications/usePublications';

import { InfoContainer } from './MainParticipantInfo';

jest.mock('../../hooks/useParticipantNetworkQualityLevel/useParticipantNetworkQualityLevel', () => () => 4);
jest.mock('../../hooks/usePublications/usePublications');

const mockUsePublications = usePublications as jest.Mock<any>;

describe('the MainParticipantInfo component', () => {
  it('should render a VideoCamOff icon when no camera tracks are present', () => {
    mockUsePublications.mockImplementation(() => []);
    const wrapper = shallow(
      <MainParticipantInfo participant={{ identity: 'mockIdentity' } as any}>mock children</MainParticipantInfo>
    );
    expect(wrapper.find('VideocamOffIcon').exists()).toEqual(true);
  });

  it('should render a VideoCamOff icon when a camera track is present and disabled', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: 'camera', isTrackEnabled: false }]);
    const wrapper = shallow(
      <MainParticipantInfo participant={{ identity: 'mockIdentity' } as any}>mock children</MainParticipantInfo>
    );
    expect(wrapper.find('VideocamOffIcon').exists()).toEqual(true);
  });

  it('should render a VideoCamOff icon when a camera tracks is present and enabled', () => {
    mockUsePublications.mockImplementation(() => [{ trackName: 'camera', isTrackEnabled: true }]);
    const wrapper = shallow(
      <MainParticipantInfo participant={{ identity: 'mockIdentity' } as any}>mock children</MainParticipantInfo>
    );
    expect(wrapper.find('VideocamOffIcon').exists()).toEqual(false);
  });
});