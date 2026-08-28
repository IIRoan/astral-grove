import { Elysia } from 'elysia';
import { FiltersResponse } from '@riftbound/contracts';
import type { CatalogMetadataService } from '../services/catalog-metadata.js';

export function createFiltersRoutes(catalogMetadata: CatalogMetadataService) {
  return new Elysia({ prefix: '/api/v1/filters' }).get(
    '/',
    { detail: { tags: ['filters'] } },
    async () => {
      const meta = await catalogMetadata.getFiltersMeta();
      return FiltersResponse.parse({
        data: meta.snapshot,
        meta: {
          cachedAt: meta.cachedAt,
          catalogHash: meta.catalogHash,
          pricesCatalogHash: meta.pricesCatalogHash,
          variantCount: meta.variantCount,
        },
      });
    }
  );
}
