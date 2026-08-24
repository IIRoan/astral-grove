import { Blobatar } from '@blobatar/react-native';
import { View } from 'react-native';
import { FACTORY_RADIUS_CONTROL_CLASS } from '@/constants/factoryShape';
import { cn } from '@/lib/utils';

type UserBlobatarProps = {
  /** Better Auth user id — same id always yields the same face. */
  userId: string;
  /** Accessible label (display name). */
  title?: string;
  size: number;
  className?: string;
  /** Draw a bordered factory-radius frame around the blobatar. */
  framed?: boolean;
};

/** Deterministic face from `userId` so name/email changes do not reshuffle it. */
export function UserBlobatar({
  userId,
  title,
  size,
  className,
  framed = false,
}: UserBlobatarProps) {
  const blobatar = (
    <Blobatar
      name={userId}
      size={size}
      title={title ?? 'User avatar'}
      background={false}
    />
  );

  if (!framed) {
    return blobatar;
  }

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
