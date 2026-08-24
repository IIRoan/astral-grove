import { Elysia, t } from 'elysia';
import {
  DeckRulesResponse,
  DeckValidateInput,
  DeckValidateResponse,
  RIFTBOUND_DECK_RULES,
  deckValidationHasErrors,
  deckValidationIsValid,
  validateRiftboundDeck,
} from '@riftbound/contracts';
import { parseRequest } from '../lib/request-validation.js';

export function createDeckRulesRoutes() {
  return new Elysia({ prefix: '/api/v1/deck-rules' })
    .get('/', { detail: { tags: ['deck-rules'] } }, () =>
      DeckRulesResponse.parse({
        data: {
          version: RIFTBOUND_DECK_RULES.version,
          rules: RIFTBOUND_DECK_RULES,
        },
      })
    )
    .post(
      '/validate',
      {
        body: t.Object({
          format: t.Optional(
            t.Union([t.Literal('constructed'), t.Literal('pre-rift')])
          ),
          legend: t.Optional(t.Nullable(t.Any())),
          champion: t.Optional(t.Nullable(t.Any())),
          mainDeck: t.Array(t.Any()),
          runes: t.Array(t.Any()),
          battlefields: t.Array(t.Any()),
          sideboard: t.Array(t.Any()),
        }),
        detail: { tags: ['deck-rules'] },
      },
      ({ body }) => {
        const input = parseRequest(DeckValidateInput, body);
        const messages = validateRiftboundDeck(input);
        return DeckValidateResponse.parse({
          data: {
            messages,
            valid: deckValidationIsValid(messages),
            hasErrors: deckValidationHasErrors(messages),
          },
        });
      }
    );
}
