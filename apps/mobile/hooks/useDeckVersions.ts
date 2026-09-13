import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast.api';
import { deserializeDeck } from '@/lib/deck-card';
import { setDeckDetailCache } from '@/lib/deck-state';
import type { DeckState } from '@/lib/deck-types';
import { logActionFailure } from '@/lib/logger';
import {
  remoteActivateDeckVersion,
  remoteCreateDeckVersion,
  remoteDeleteDeckVersion,
  remoteRenameDeckVersion,
} from '@/services/remoteDeckService';

function applySavedDeck(
  queryClient: ReturnType<typeof useQueryClient>,
  saved: DeckState
): DeckState {
  setDeckDetailCache(queryClient, saved);
  return saved;
}

export function useDeckVersions() {
  const queryClient = useQueryClient();

  const createVersion = useMutation({
    mutationFn: async (input: { deckId: string; name: string }) => {
      const saved = await remoteCreateDeckVersion(input.deckId, input.name);
      return deserializeDeck(saved);
    },
    onSuccess: (saved) => {
      applySavedDeck(queryClient, saved);
      toast.success(`Saved as “${saved.versionName ?? saved.name}”.`);
    },
    onError: (error) => {
      logActionFailure('decks.versions.create', error);
      toast.error('Could not create version.');
    },
  });

  const renameVersion = useMutation({
    mutationFn: async (input: { deckId: string; versionId: string; name: string }) => {
      const saved = await remoteRenameDeckVersion(
        input.deckId,
        input.versionId,
        input.name
      );
      return deserializeDeck(saved);
    },
    onSuccess: (saved) => {
      applySavedDeck(queryClient, saved);
    },
    onError: (error) => {
      logActionFailure('decks.versions.rename', error);
      toast.error('Could not rename version.');
    },
  });

  const deleteVersion = useMutation({
    mutationFn: async (input: { deckId: string; versionId: string }) => {
      const saved = await remoteDeleteDeckVersion(input.deckId, input.versionId);
      return deserializeDeck(saved);
    },
    onSuccess: (saved) => {
      applySavedDeck(queryClient, saved);
      toast.success('Version deleted.');
    },
    onError: (error) => {
      logActionFailure('decks.versions.delete', error);
      toast.error('Could not delete version.');
    },
  });

  const activateVersion = useMutation({
    mutationFn: async (input: { deckId: string; versionId: string }) => {
      const saved = await remoteActivateDeckVersion(input.deckId, input.versionId);
      return deserializeDeck(saved);
    },
    onSuccess: (saved) => {
      applySavedDeck(queryClient, saved);
    },
    onError: (error) => {
      logActionFailure('decks.versions.activate', error);
      toast.error('Could not switch version.');
    },
  });

  return {
    createVersion,
    renameVersion,
    deleteVersion,
    activateVersion,
  };
}
