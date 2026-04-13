import SettingsBroadcast from '@app/components/Settings/SettingsBroadcast';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const BroadcastPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsBroadcast />
    </SettingsLayout>
  );
};

export default BroadcastPage;
