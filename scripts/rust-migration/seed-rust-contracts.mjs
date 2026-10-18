import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as contracts from '../../packages/contracts/src/index.ts';

if (!process.argv.includes('--initialize'))
  throw new Error('This seeds initial Rust source only; use --initialize explicitly');
const dtoPath =
  process.env.RUST_SEED_DTO_OUTPUT ??
  resolve(import.meta.dir, '../../crates/astral-grove-api-types/src/contracts.rs');
const validatorPath =
  process.env.RUST_SEED_SCHEMA_OUTPUT ??
  resolve(import.meta.dir, '../../apps/backend/src/http/schemas.rs');
if (existsSync(dtoPath) || existsSync(validatorPath))
  throw new Error('Refusing to overwrite established Rust source');
let sourceSchemas = contracts;
if (process.env.RUST_SEED_INTERNAL_DECKS === 'true') {
  Bun.plugin({
    name: 'read-pinned-internal-deck-schemas',
    setup(builder) {
      builder.onLoad(
        { filter: /tests\/reference-api\/src\/services\/deck-sync\.ts$/ },
        (args) => ({
          contents: readFileSync(args.path, 'utf8')
            .replace('const UpstreamDeckDetail =', 'export const UpstreamDeckDetail =')
            .replace(
              'const UpstreamDeckListResponse =',
              'export const UpstreamDeckListResponse ='
            ),
          loader: 'ts',
        })
      );
    },
  });
  const internal = await import('../../tests/reference-api/src/services/deck-sync.ts');
  sourceSchemas = {
    UpstreamDeckDetail: internal.UpstreamDeckDetail,
    UpstreamDeckListResponse: internal.UpstreamDeckListResponse,
  };
}
const exports = Object.entries(sourceSchemas).filter(
  ([, value]) => value && typeof value === 'object' && value._def
);
const names = new Map();
for (const [name, schema] of exports) if (!names.has(schema)) names.set(schema, name);
const definitions = new Map();
const pascal = (text) =>
  text.replace(/(^|[^a-zA-Z0-9])([a-zA-Z0-9])/g, (_, _prefix, c) => c.toUpperCase());
const snake = (text) => text.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const quote = JSON.stringify;

function transformed(schema) {
  const text = schema._def.effect.transform.toString();
  if (text.includes('parseAllowedThumbWidth'))
    return {
      type: 'Option<i64>',
      code: 'z::preprocess(super::thumb_width, z::number().int().optional())',
    };
  if (text.includes('value === "true"') && !text.includes('typeof'))
    return {
      type: 'bool',
      code: `${validator(schema._def.schema)}.transform(|value| serde_json::json!(value.as_str() == Some("true")))`,
    };
  if (text.includes('typeof value === "boolean"'))
    return {
      type: 'Option<bool>',
      code: `${validator(schema._def.schema)}.transform(|value| serde_json::json!(value.as_bool().unwrap_or_else(|| matches!(value.as_str(), Some("true" | "1")))))`,
    };
  if (text.includes('?? "Standard"'))
    return {
      type: 'String',
      code: `${validator(schema._def.schema)}.transform(|value| if value.is_null() { serde_json::json!("Standard") } else { value })`,
    };
  if (text.includes('?? ""'))
    return {
      type: 'String',
      code: `${validator(schema._def.schema)}.transform(|value| if value.is_null() { serde_json::json!("") } else { value })`,
    };
  if (text.includes('?? []'))
    return {
      type: 'Vec<String>',
      code: `${validator(schema._def.schema)}.transform(|value| if value.is_null() { serde_json::json!([]) } else { value })`,
    };
  throw new Error(`Unmapped transform: ${text}`);
}

function rustType(schema, name, root = false) {
  const canonical = names.get(schema);
  if (canonical && canonical !== name && !root) return canonical;
  const d = schema._def;
  switch (d.typeName) {
    case 'ZodEffects':
      return transformed(schema).type;
    case 'ZodDefault':
      return rustType(
        d.innerType._def.typeName === 'ZodOptional'
          ? d.innerType._def.innerType
          : d.innerType,
        name,
        root
      );
    case 'ZodOptional':
      return `Option<${rustType(d.innerType, name, root)}>`;
    case 'ZodNullable':
      return `Option<${rustType(d.innerType, name, root)}>`;
    case 'ZodString':
      return 'String';
    case 'ZodNumber':
      return d.checks.some((check) => check.kind === 'int') ? 'i64' : 'f64';
    case 'ZodBoolean':
      return 'bool';
    case 'ZodLiteral':
      return typeof d.value === 'boolean'
        ? 'bool'
        : typeof d.value === 'number'
          ? 'i64'
          : 'String';
    case 'ZodUnknown':
    case 'ZodAny':
      return 'serde_json::Value';
    case 'ZodArray':
      return `Vec<${rustType(d.type, `${name}Item`)}>`;
    case 'ZodRecord':
      return `std::collections::BTreeMap<String, ${rustType(d.valueType, `${name}Value`)}>`;
    case 'ZodEnum': {
      if (!definitions.has(name))
        definitions.set(
          name,
          `#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]\npub enum ${name} {\n${d.values.map((value, index) => `    #[serde(rename = ${quote(value)})]\n    ${pascal(value) || `Value${index}`},`).join('\n')}\n}`
        );
      return name;
    }
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion': {
      const options = d.options instanceof Map ? [...d.options.values()] : d.options;
      if (!definitions.has(name))
        definitions.set(
          name,
          `#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]\n#[serde(untagged)]\npub enum ${name} {\n${options.map((option, index) => `    Variant${index}(${rustType(option, `${name}Variant${index}`)}),`).join('\n')}\n}`
        );
      return name;
    }
    case 'ZodObject': {
      if (!definitions.has(name)) {
        definitions.set(name, '');
        const fields = Object.entries(d.shape()).map(([key, child]) => {
          let field = snake(key);
          if (
            [
              'type',
              'super',
              'default',
              'ref',
              'match',
              'self',
              'use',
              'mod',
              'loop',
              'move',
              'where',
              'as',
              'in',
              'enum',
              'struct',
              'fn',
              'pub',
              'crate',
              'async',
              'await',
            ].includes(field)
          )
            field += '_';
          const optional = child.isOptional() && child._def.typeName !== 'ZodDefault';
          const nullable = child.isNullable();
          let type = rustType(child, `${name}${pascal(key)}`);
          const attrs = [`    #[serde(rename = ${quote(key)})]`];
          if (optional && nullable) {
            type = `Option<Option<${type.replace(/^Option<(.*)>$/, '$1').replace(/^Option<(.*)>$/, '$1')}>>`;
            attrs.push(
              '    #[serde(default, skip_serializing_if = "Option::is_none", with = "serde_with::rust::double_option")]'
            );
          } else if (optional) {
            if (!type.startsWith('Option<')) type = `Option<${type}>`;
            attrs.push(
              '    #[serde(default, skip_serializing_if = "Option::is_none")]'
            );
          }
          if (!optional && nullable)
            attrs.push('    #[schema(required = true, nullable = true)]');
          return `${attrs.join('\n')}\n    pub ${field}: ${type},`;
        });
        definitions.set(
          name,
          `#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]\npub struct ${name} {\n${fields.join('\n')}\n}`
        );
      }
      return name;
    }
    default:
      throw new Error(`Unsupported Rust type ${d.typeName} at ${name}`);
  }
}

function validator(schema, root = false) {
  const canonical = names.get(schema);
  if (canonical && !root) return `schema(${quote(canonical)})`;
  const d = schema._def;
  switch (d.typeName) {
    case 'ZodEffects':
      return transformed(schema).code;
    case 'ZodDefault':
      return `${validator(d.innerType)}.default(serde_json::json!(${JSON.stringify(d.defaultValue())}))`;
    case 'ZodOptional':
      return `${validator(d.innerType)}.optional()`;
    case 'ZodNullable':
      return `${validator(d.innerType)}.nullable()`;
    case 'ZodUnknown':
    case 'ZodAny':
      return 'z::any()';
    case 'ZodBoolean':
      return 'z::boolean()';
    case 'ZodLiteral':
      return `${typeof d.value === 'boolean' ? 'z::boolean()' : typeof d.value === 'number' ? 'z::number()' : 'z::string()'}.refine(|value| value == &serde_json::json!(${JSON.stringify(d.value)}), "Invalid literal", &[])`;
    case 'ZodEnum':
      return `z::enumeration(&[${d.values.map(quote).join(',')}])`;
    case 'ZodRecord':
      return `z::record_values(${validator(d.valueType)})`;
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion':
      return `z::union(vec![${[...(d.options instanceof Map ? d.options.values() : d.options)].map((option) => validator(option)).join(',')}])`;
    case 'ZodObject':
      return `z::object([${Object.entries(d.shape())
        .map(([key, value]) => `(${quote(key)}, ${validator(value)})`)
        .join(',')}])${d.unknownKeys === 'strict' ? '.strict()' : ''}`;
    case 'ZodArray':
      return `z::array(${validator(d.type)})${d.minLength ? `.min(${d.minLength.value})` : ''}${d.maxLength ? `.max(${d.maxLength.value})` : ''}`;
    case 'ZodNumber':
      return `${d.coerce ? 'z::coerce_number()' : 'z::number()'}${d.checks
        .map((check) =>
          check.kind === 'int'
            ? '.int()'
            : check.kind === 'min'
              ? `.${check.inclusive === false ? 'gt' : 'gte'}(${check.value}.0)`
              : check.kind === 'max'
                ? `.${check.inclusive === false ? 'lt' : 'lte'}(${check.value}.0)`
                : (() => {
                    throw new Error(`Number check ${check.kind}`);
                  })()
        )
        .join('')}`;
    case 'ZodString':
      return `z::string()${d.checks
        .map((check) => {
          if (check.kind === 'min' || check.kind === 'max')
            return `.${check.kind}(${check.value})`;
          if (['trim', 'datetime', 'url', 'email'].includes(check.kind))
            return `.${check.kind}()`;
          if (check.kind === 'uuid')
            return '.refine(|value| value.as_str().is_some_and(super::valid_uuid), "Invalid uuid", &[])';
          if (check.kind === 'date')
            return '.refine(|value| value.as_str().is_some_and(super::valid_date), "Invalid date", &[])';
          if (check.kind === 'regex')
            return `.refine(|value| value.as_str().is_some_and(|text| regex_lite::Regex::new(${quote(check.regex.source)}).is_ok_and(|pattern| pattern.is_match(text))), "Invalid", &[])`;
          throw new Error(`String check ${check.kind}`);
        })
        .join('')}`;
    default:
      throw new Error(`Unsupported validator ${d.typeName}`);
  }
}

const aliases = [];
for (const [name, schema] of exports) {
  const canonical = names.get(schema);
  const type = canonical !== name ? canonical : rustType(schema, name, true);
  if (type !== name) aliases.push(`pub type ${name} = ${type};`);
}
const registered = [...definitions.keys()];
writeFileSync(
  dtoPath,
  `//! Wire DTOs initialized from the pinned API baseline; evolve Rust DTOs and regenerate OpenAPI together.\n\n${[...definitions.values()].join('\n\n')}\n\n${aliases.join('\n')}\n\n#[derive(utoipa::OpenApi)]\n#[openapi(components(schemas(${registered.join(',')})))]\npub struct ContractSchemas;\n`
);
writeFileSync(
  validatorPath,
  `//! Request normalizers initialized from the pinned Zod baseline; differential tests enforce parity.\n\nuse super::zod as z;\n\npub fn schema(name: &str) -> z::Schema {\n    match name {\n${exports.map(([name, schema]) => `        ${quote(name)} => ${validator(schema, true)},`).join('\n')}\n        _ => panic!("Unknown internal contract schema: {name}"),\n    }\n}\n`
);
console.log(
  `Initialized ${definitions.size} Rust DTO definitions and ${exports.length} schema entries`
);
