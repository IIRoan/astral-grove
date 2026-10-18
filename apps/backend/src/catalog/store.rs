use super::{hash, mapper};
use crate::{
    AppState, db,
    error::{AppError, Result},
    http, upstream,
};
use sea_orm::TransactionTrait;
use serde_json::{Value, json};
pub async fn upsert(state: &AppState, card: &Value) -> Result<bool> {
    let card = http::schemas::schema("PaLogicalCard")
        .parse(Some(card))
        .map_err(|_| AppError::internal())?
        .ok_or_else(AppError::internal)?;
    let digest = hash(&card);
    let id = db::string(&card, "id");
    let tx = state.db.begin().await?;
    let exists = db::rows(
        &tx,
        "SELECT content_hash AS hash FROM cards WHERE id=$1::uuid",
        vec![id.into()],
    )
    .await?;
    if exists.first().is_some_and(|row| row["hash"] == digest) {
        for variant in card["variants"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or(&[])
        {
            if !variant["cardmarketId"].is_null() || !variant["tcgplayerId"].is_null() {
                db::execute(&tx,"UPDATE variants SET cardmarket_id=coalesce(($1->>'cardmarketId')::integer,cardmarket_id),tcgplayer_id=coalesce(($1->>'tcgplayerId')::integer,tcgplayer_id),updated_at=now() WHERE variant_number=$1->>'variantNumber'",vec![variant.clone().into()]).await?;
            }
        }
        tx.commit().await?;
        state.catalog.invalidate().await;
        return Ok(false);
    }
    for color in card["colors"].as_array().map(Vec::as_slice).unwrap_or(&[]) {
        db::execute(&tx,"INSERT INTO colors(id,name,hex_code,image_url) VALUES(($1->>'id')::uuid,$1->>'name',$1->>'hexCode',$1->>'imageUrl') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,hex_code=EXCLUDED.hex_code,image_url=EXCLUDED.image_url",vec![color.clone().into()]).await?;
    }
    db::execute(&tx,"INSERT INTO cards(id,name,type,super,description,energy,might,power,tags,attach_text,effect,might_bonus,max_copies,ban_effective_date,content_hash,upstream_raw,fetched_at) VALUES(($1->>'id')::uuid,$1->>'name',$1->>'type',$1->>'super',$1->>'description',($1->>'energy')::smallint,($1->>'might')::smallint,($1->>'power')::smallint,$1->'tags',$1->>'attachText',$1->>'effect',coalesce(($1->>'mightBonus')::smallint,0),($1->>'maxCopies')::smallint,$3::timestamptz,$2,$1,now()) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,super=EXCLUDED.super,description=EXCLUDED.description,energy=EXCLUDED.energy,might=EXCLUDED.might,power=EXCLUDED.power,tags=EXCLUDED.tags,attach_text=EXCLUDED.attach_text,effect=EXCLUDED.effect,might_bonus=EXCLUDED.might_bonus,max_copies=EXCLUDED.max_copies,ban_effective_date=EXCLUDED.ban_effective_date,content_hash=EXCLUDED.content_hash,upstream_raw=EXCLUDED.upstream_raw,fetched_at=now(),updated_at=now()",vec![card.clone().into(),digest.into(),card.get("banEffectiveDate").and_then(Value::as_str).map(|value|crate::instant::milliseconds_only(value).into_owned()).into()]).await?;
    db::execute(
        &tx,
        "DELETE FROM card_colors WHERE card_id=$1::uuid",
        vec![id.into()],
    )
    .await?;
    for color in card["colors"].as_array().map(Vec::as_slice).unwrap_or(&[]) {
        db::execute(
            &tx,
            "INSERT INTO card_colors(card_id,color_id) VALUES($1::uuid,$2::uuid)",
            vec![id.into(), db::string(color, "id").into()],
        )
        .await?;
    }
    for variant in card["variants"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or(&[])
    {
        let set = &variant["set"];
        db::execute(&tx,"INSERT INTO sets(id,code,name,release_date) VALUES(($1->>'id')::uuid,$1->>'prefix',$1->>'name',$1->>'releaseDate') ON CONFLICT(id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,release_date=EXCLUDED.release_date,updated_at=now()",vec![set.clone().into()]).await?;
        write_variant(&tx, id, variant, false).await?;
    }
    tx.commit().await?;
    state.catalog.invalidate().await;
    Ok(true)
}
pub async fn hashes(state: &AppState) -> Result<(String, String)> {
    let rows = db::rows(
        &state.db,
        "SELECT key,content_hash AS hash FROM sync_state WHERE key=ANY(ARRAY['catalog','prices'])",
        vec![],
    )
    .await?;
    let catalog = rows
        .iter()
        .find(|row| row["key"] == "catalog")
        .map(|row| db::string(row, "hash").to_owned())
        .unwrap_or_default();
    let prices = rows
        .iter()
        .find(|row| row["key"] == "prices")
        .map(|row| db::string(row, "hash"))
        .unwrap_or("");
    let count = db::rows(
        &state.db,
        "SELECT count(*)::bigint AS total FROM variants WHERE cardmarket_id IS NOT NULL",
        vec![],
    )
    .await?
    .first()
    .and_then(|row| row["total"].as_i64())
    .unwrap_or(0);
    Ok((catalog, format!("{prices}:{count}")))
}
pub async fn logical(state: &AppState, number: &str) -> Result<Option<(Value, String)>> {
    let Some(card)=db::rows(&state.db,"SELECT c.id::text AS id,c.upstream_raw AS raw,c.content_hash AS hash FROM variants v JOIN cards c ON c.id=v.card_id WHERE lower(v.variant_number)=lower($1) LIMIT 1",vec![number.into()]).await?.into_iter().next()else{return Ok(None)};
    let mut logical = card["raw"].clone();
    let variants=db::rows(&state.db,"SELECT upstream_raw AS raw,variant_number AS \"variantNumber\",cardmarket_id AS \"cardmarketId\",tcgplayer_id AS \"tcgplayerId\" FROM variants WHERE card_id=$1::uuid",vec![db::string(&card,"id").into()]).await?;
    if let Some(items) = logical["variants"].as_array_mut() {
        let mut extra = false;
        for variant in &variants {
            if let Some(item) = items.iter_mut().find(|item| {
                db::string(item, "variantNumber")
                    .eq_ignore_ascii_case(db::string(variant, "variantNumber"))
            }) {
                for key in ["cardmarketId", "tcgplayerId"] {
                    if item[key].is_null() {
                        item[key] = variant[key].clone();
                    }
                }
            } else {
                let mut item = variant["raw"].clone();
                for key in ["cardmarketId", "tcgplayerId"] {
                    if !variant[key].is_null() {
                        item[key] = variant[key].clone();
                    }
                }
                items.push(item);
                extra = true;
            }
        }
        if extra {
            items.sort_by(|a, b| {
                crate::search::compare(
                    db::string(a, "variantNumber"),
                    db::string(b, "variantNumber"),
                )
            });
        }
    }
    Ok(Some((logical, db::string(&card, "hash").into())))
}
pub async fn detail(state: &AppState, number: &str, refresh: bool) -> Result<Value> {
    let cached = logical(state, number).await?;
    if let Some((card, hash)) = &cached
        && !refresh
    {
        return Ok(
            json!({"data":mapper::detail(state,card,&crate::prices::all(state).await?),"meta":{"source":"cache","contentHash":hash}}),
        );
    }
    let card = match upstream::card(state, number).await {
        Ok(card) => card,
        Err(error) => {
            if error.status == 404
                && number.trim().ends_with('*')
                && let Some((card, hash)) = cached
            {
                return Ok(
                    json!({"data":mapper::detail(state,&card,&crate::prices::all(state).await?),"meta":{"source":"cache","contentHash":hash}}),
                );
            }
            return Err(error.into());
        }
    };
    let changed = upsert(state, &card).await?;
    let (card, hash) = logical(state, number)
        .await?
        .unwrap_or_else(|| (card.clone(), hash(&card)));
    let source = if cached.is_none() {
        "upstream"
    } else if changed {
        "cache-refreshed"
    } else {
        "cache"
    };
    Ok(
        json!({"data":mapper::detail(state,&card,&crate::prices::all(state).await?),"meta":{"source":source,"contentHash":hash}}),
    )
}

pub async fn write_variant(
    db: &impl sea_orm::ConnectionTrait,
    card_id: &str,
    variant: &Value,
    ignore: bool,
) -> Result<u64> {
    let suffix = if ignore {
        " ON CONFLICT(variant_number) DO NOTHING"
    } else {
        " ON CONFLICT(variant_number) DO UPDATE SET card_id=EXCLUDED.card_id,rarity=EXCLUDED.rarity,variant_type=EXCLUDED.variant_type,foil_mode=EXCLUDED.foil_mode,variant_types=EXCLUDED.variant_types,image_url=EXCLUDED.image_url,flavor_text=EXCLUDED.flavor_text,artist=EXCLUDED.artist,release_date=EXCLUDED.release_date,variant_label=EXCLUDED.variant_label,show_in_library=EXCLUDED.show_in_library,is_collectible=EXCLUDED.is_collectible,cardmarket_id=coalesce(EXCLUDED.cardmarket_id,variants.cardmarket_id),tcgplayer_id=EXCLUDED.tcgplayer_id,parent_variant_id=EXCLUDED.parent_variant_id,set_id=EXCLUDED.set_id,content_hash=EXCLUDED.content_hash,upstream_raw=EXCLUDED.upstream_raw,fetched_at=now(),updated_at=now()"
    };
    db::execute(db,&format!("INSERT INTO variants(id,card_id,variant_number,rarity,variant_type,foil_mode,variant_types,image_url,flavor_text,artist,release_date,variant_label,show_in_library,is_collectible,cardmarket_id,tcgplayer_id,parent_variant_id,set_id,content_hash,upstream_raw,fetched_at) VALUES(($1->>'id')::uuid,$2::uuid,$1->>'variantNumber',$1->>'rarity',$1->>'variantType',$1->>'foilMode',$1->'variantTypes',$1->>'imageUrl',$1->>'flavorText',$1->>'artist',$1->>'releaseDate',$1->>'variantLabel',($1->>'showInLibrary')::boolean,($1->>'isCollectible')::boolean,($1->>'cardmarketId')::integer,($1->>'tcgplayerId')::integer,($1->>'parentVariantId')::uuid,($1->'set'->>'id')::uuid,$3,$1,now()){suffix}"),vec![variant.clone().into(),card_id.into(),hash(variant).into()]).await
}
