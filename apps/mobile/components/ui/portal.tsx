import { useLayoutEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { logDrawer } from '@/lib/drawer-debug';
import {
  shouldMountFullWindowOverlay,
  useInAppBrowserOverlaySuspended,
} from '@/lib/in-app-browser-overlay';

const DEFAULT_PORTAL_HOST = 'TETRA_UI_DEFAULT_HOST_NAME';

type PortalHostProps = {
  name?: string;
};

type PortalProps = {
  name: string;
  hostName?: string;
  children: React.ReactNode;
};

type PortalMap = Map<string, React.ReactNode>;

type PortalHostMap = Map<string, PortalMap>;

type PortalListener = () => void;

export function PortalOverlay({ children }: { children: React.ReactNode }) {
  const inAppBrowserOpen = useInAppBrowserOverlaySuspended();
  const useFullWindow = shouldMountFullWindowOverlay({
    platform: Platform.OS,
    inAppBrowserOpen,
  });

  useLayoutEffect(() => {
    logDrawer('portal.overlay', {
      platform: Platform.OS,
      inAppBrowserOpen,
      fullWindowOverlay: useFullWindow,
    });
  }, [inAppBrowserOpen, useFullWindow]);

  if (useFullWindow) {
    return <FullWindowOverlay>{children}</FullWindowOverlay>;
  }
  return <>{children}</>;
}

export const PortalHost = ({ name = DEFAULT_PORTAL_HOST }: PortalHostProps) => {
  const map = usePortalMap();
  const portal = map.get(name) ?? new Map<string, React.ReactNode>();

  if (portal.size === 0) {
    return null;
  }

  return <>{Array.from(portal.values())}</>;
};

export const Portal = ({
  name,
  hostName = DEFAULT_PORTAL_HOST,
  children,
}: PortalProps) => {
  // Layout effect before paint — useEffect cleanup raced drawer open and left a dead host.
  useLayoutEffect(() => {
    updatePortal(hostName, name, children);
  }, [hostName, name, children]);

  useLayoutEffect(() => {
    return () => {
      removePortal(hostName, name);
    };
  }, [hostName, name]);

  return null;
};

const usePortalMap = () => {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => portalMap
  );
};

let portalMap: PortalHostMap = new Map<string, PortalMap>().set(
  DEFAULT_PORTAL_HOST,
  new Map<string, React.ReactNode>()
);

const listeners = new Set<PortalListener>();

function getPortalHostSnapshot(): Array<{
  hostName: string;
  names: string[];
  size: number;
}> {
  return Array.from(portalMap.entries()).map(([hostName, portal]) => ({
    hostName,
    names: Array.from(portal.keys()),
    size: portal.size,
  }));
}

const notifyListeners = () => {
  for (const listener of listeners) {
    listener();
  }
};

const updatePortal = (hostName: string, name: string, content: React.ReactNode) => {
  const existed = portalMap.get(hostName)?.has(name) === true;
  const next = new Map(portalMap);
  const portal = next.get(hostName) ?? new Map<string, React.ReactNode>();
  const updatedPortal = new Map(portal);
  updatedPortal.set(name, content);
  next.set(hostName, updatedPortal);
  portalMap = next;
  notifyListeners();
  if (!existed) {
    logDrawer('portal.attach', {
      hostName,
      name,
      platform: Platform.OS,
      hosts: getPortalHostSnapshot(),
    });
  }
};

const removePortal = (hostName: string, name: string) => {
  const next = new Map(portalMap);
  const portal = next.get(hostName);
  if (portal) {
    const existed = portal.has(name);
    const updatedPortal = new Map(portal);
    updatedPortal.delete(name);
    if (updatedPortal.size === 0) {
      next.delete(hostName);
    } else {
      next.set(hostName, updatedPortal);
    }
    portalMap = next;
    notifyListeners();
    if (existed) {
      logDrawer('portal.detach', {
        hostName,
        name,
        platform: Platform.OS,
        hosts: getPortalHostSnapshot(),
      });
    }
  }
};
