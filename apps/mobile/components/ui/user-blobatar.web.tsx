import { Blobatar } from 'blobatar/react';
import { View } from 'react-native';
import { blobatarPlatformPassthrough } from '@/components/ui/user-blobatar-passthrough';
import { FACTORY_RADIUS_CONTROL_CLASS } from '@/constants/factoryShape';
import { cn } from '@/lib/utils';

type UserBlobatarProps = {
  userId: string;
  title?: string;
  size: number;
  className?: string;
  framed?: boolean;
};

export function UserBlobatar({
  userId,
  title,
  size,
  className,
  framed = false,
}: UserBlobatarProps) {
  const label = title || 'User avatar';
  const blobatar = (
    <Blobatar
      name={userId}
      size={size}
      background={false}
      {...blobatarPlatformPassthrough(label)}
    />
  );

  if (!framed) return blobatar;

  return (
    <View
      className={cn(
        'overflow-hidden border border-border',
        FACTORY_RADIUS_CONTROL_CLASS,
        className
      )}
      style={{ width: size, height: size }}
    >
      {blobatar}
    </View>
  );
}
