use super::membership;
use crate::{
    AppState,
    auth::RouteUser,
    db,
    error::{AppError, Result},
    http,
};
use axum::{
    Json,
    extract::{Path, State},
};
use sea_orm::{ConnectionTrait, TransactionTrait};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use utoipa_axum::{router::OpenApiRouter, routes};
fn error(code: &str, message: &str) -> AppError {
    AppError::new(
        match code {
            "NOT_FOUND" => 404,
            "CONFLICT" => 409,
            "FORBIDDEN" => 403,
            _ => 400,
        },
        code,
        message,
    )
}
pub fn token_hash(token: &str) -> String {
    format!("sha256:{}", hex::encode(Sha256::digest(token.as_bytes())))
}
fn token_keys(token: &str) -> Vec<String> {
    let hash = token_hash(token);
    if token.starts_with("sha256:") || token == hash {
        vec![hash]
    } else {
        vec![hash, token.into()]
    }
}
async fn member_count(db: &impl ConnectionTrait, collection: &str) -> Result<usize> {
    Ok(db::rows(
        db,
        "SELECT user_id FROM collection_members WHERE collection_id=$1::uuid",
        vec![collection.into()],
    )
    .await?
    .len())
}
async fn status(db: &impl ConnectionTrait, user: &str, collection: &str) -> Result<Value> {
    let rows=db::rows(db,"SELECT m.user_id AS \"userId\",m.role,u.name,u.email FROM collection_members m JOIN \"user\" u ON u.id=m.user_id WHERE m.collection_id=$1::uuid",vec![collection.into()]).await?;
    let role = rows
        .iter()
        .find(|row| row["userId"] == user)
        .map(|row| db::string(row, "role"))
        .unwrap_or("owner");
    let shared = rows.len() >= 2;
    let partner = rows
        .iter()
        .find(|row| row["userId"] != user)
        .map(|row| json!({"userId":row["userId"],"name":row["name"],"email":row["email"]}));
    let pending = if shared {
        None
    } else {
        db::rows(db,"SELECT to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"expiresAt\" FROM collection_invites WHERE collection_id=$1::uuid AND status='pending' AND expires_at>=now() LIMIT 1",vec![collection.into()]).await?.into_iter().next()
    };
    Ok(
        json!({"shared":shared,"memberCount":rows.len(),"collectionId":collection,"role":if role=="member"{"member"}else{"owner"},"partner":partner,"pendingInvite":pending}),
    )
}
async fn pending(state: &AppState, token: &str) -> Result<Value> {
    let invite=db::rows(&state.db,"SELECT id::text AS id,collection_id::text AS collection,inviter_user_id AS inviter,status,expires_at<now() AS expired,to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"expiresAt\" FROM collection_invites WHERE token=ANY($1::text[]) LIMIT 1",vec![token_keys(token).into()]).await?.into_iter().next().ok_or_else(||error("NOT_FOUND","Invite not found"))?;
    if invite["status"] != "pending" {
        return Err(error("BAD_REQUEST", "Invite is no longer valid"));
    }
    if invite["expired"] == true {
        db::execute(
            &state.db,
            "UPDATE collection_invites SET status='expired' WHERE id=$1::uuid AND status='pending'",
            vec![db::string(&invite, "id").into()],
        )
        .await?;
        return Err(error("BAD_REQUEST", "Invite has expired"));
    }
    Ok(invite)
}
#[utoipa::path(get,path="/api/v1/collection/share",operation_id="collectionSharingStatus",responses((status=200,body=astral_grove_api_types::CollectionShareStatusResponse)))]
async fn get_status(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<astral_grove_api_types::CollectionShareStatusResponse>> {
    let collection = membership::ensure(&state, &session.user.id).await?;
    http::respond(
        "CollectionShareStatusResponse",
        json!({"data":status(&state.db,&session.user.id,&collection).await?}),
    )
}
#[utoipa::path(post,path="/api/v1/collection/share/invite",operation_id="createCollectionInvite",responses((status=200,body=astral_grove_api_types::CollectionShareInviteCreateResponse)))]
async fn invite(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<astral_grove_api_types::CollectionShareInviteCreateResponse>> {
    let collection = membership::ensure(&state, &session.user.id).await?;
    let tx = state.db.begin().await?;
    db::execute(&tx, "SELECT pg_advisory_xact_lock(1280472986)", vec![]).await?;
    db::rows(
        &tx,
        "SELECT id FROM collections WHERE id=$1::uuid FOR UPDATE",
        vec![collection.clone().into()],
    )
    .await?;
    if member_count(&tx, &collection).await? >= 2 {
        return Err(error(
            "CONFLICT",
            "Collection already has the maximum of 2 members",
        ));
    }
    db::execute(&tx,"UPDATE collection_invites SET status='revoked' WHERE collection_id=$1::uuid AND status='pending'",vec![collection.clone().into()]).await?;
    use rand::RngExt;
    let token = hex::encode(rand::rng().random::<[u8; 32]>());
    let expires = time::OffsetDateTime::now_utc() + time::Duration::days(7);
    db::execute(&tx,"INSERT INTO collection_invites(token,collection_id,inviter_user_id,expires_at) VALUES($1,$2::uuid,$3,$4::timestamptz)",vec![token_hash(&token).into(),collection.into(),session.user.id.into(),db::iso(expires).into()]).await?;
    tx.commit().await?;
    http::respond(
        "CollectionShareInviteCreateResponse",
        json!({"data":{"token":token,"url":format!("{}/invite/{token}",state.config.public_url.trim_end_matches('/')),"expiresAt":db::iso(expires)}}),
    )
}
#[utoipa::path(post,path="/api/v1/collection/share/invite/revoke",operation_id="revokeCollectionInvite",responses((status=200,body=astral_grove_api_types::OkResponse)))]
async fn revoke(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<astral_grove_api_types::OkResponse>> {
    let collection = membership::ensure(&state, &session.user.id).await?;
    let tx = state.db.begin().await?;
    db::execute(&tx, "SELECT pg_advisory_xact_lock(1280472986)", vec![]).await?;
    db::execute(&tx,"UPDATE collection_invites SET status='revoked' WHERE collection_id=$1::uuid AND status='pending'",vec![collection.into()]).await?;
    tx.commit().await?;
    http::respond("OkResponse", json!({"data":{"ok":true}}))
}
#[utoipa::path(get,path="/api/v1/collection/share/invite/{token}",operation_id="previewCollectionInvite",responses((status=200,body=astral_grove_api_types::CollectionShareInvitePreviewResponse)))]
async fn preview(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Json<astral_grove_api_types::CollectionShareInvitePreviewResponse>> {
    let invite = pending(&state, &token).await?;
    let inviter = db::string(&invite, "inviter");
    membership::ensure(&state, inviter).await?;
    let your_collection = membership::ensure(&state, &session.user.id).await?;
    let their_collection = db::string(&invite, "collection");
    let user = db::rows(
        &state.db,
        "SELECT id AS \"userId\",name FROM \"user\" WHERE id=$1",
        vec![inviter.into()],
    )
    .await?
    .into_iter()
    .next()
    .ok_or_else(|| error("NOT_FOUND", "Inviter not found"))?;
    let stats=db::rows(&state.db,"SELECT collection_id::text AS id,count(*)::bigint AS count,coalesce(sum(quantity),0)::bigint AS quantity FROM collection_items WHERE collection_id::text=ANY($1::text[]) GROUP BY collection_id",vec![vec![your_collection.clone(),their_collection.into()].into()]).await?;
    let their = stats.iter().find(|row| row["id"] == their_collection);
    let your = stats.iter().find(|row| row["id"] == your_collection);
    let reason = if session.user.id == inviter {
        Some("You cannot accept your own invite")
    } else if your_collection == their_collection {
        Some("You are already a member of this collection")
    } else if member_count(&state.db, their_collection).await? >= 2 {
        Some("This collection already has 2 members")
    } else if member_count(&state.db, &your_collection).await? >= 2 {
        Some("Leave your current shared collection before joining another")
    } else {
        None
    };
    http::respond(
        "CollectionShareInvitePreviewResponse",
        json!({"data":{"token":token,"expiresAt":invite["expiresAt"],"inviter":user,"theirItemCount":their.and_then(|row|row["count"].as_i64()).unwrap_or(0),"theirTotalQuantity":their.and_then(|row|row["quantity"].as_i64()).unwrap_or(0),"yourItemCount":your.and_then(|row|row["count"].as_i64()).unwrap_or(0),"yourTotalQuantity":your.and_then(|row|row["quantity"].as_i64()).unwrap_or(0),"canAccept":reason.is_none(),"reason":reason}}),
    )
}
#[utoipa::path(post,path="/api/v1/collection/share/invite/{token}/accept",operation_id="acceptCollectionInvite",request_body=astral_grove_api_types::CollectionShareAcceptRequest,responses((status=200,body=astral_grove_api_types::CollectionShareAcceptResponse)))]
async fn accept(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<astral_grove_api_types::CollectionShareAcceptResponse>> {
    let input = http::value("CollectionShareAcceptRequest", &body)?;
    membership::ensure(&state, &session.user.id).await?;
    let tx = state.db.begin().await?;
    db::execute(&tx, "SELECT pg_advisory_xact_lock(1280472986)", vec![]).await?;
    let invite=db::rows(&tx,"SELECT id::text AS id,collection_id::text AS collection,inviter_user_id AS inviter,status,expires_at<now() AS expired FROM collection_invites WHERE token=ANY($1::text[]) LIMIT 1 FOR UPDATE",vec![token_keys(&token).into()]).await?.into_iter().next().ok_or_else(||error("NOT_FOUND","Invite not found or no longer valid"))?;
    if invite["status"] != "pending" {
        return Err(error("NOT_FOUND", "Invite not found or no longer valid"));
    }
    if invite["expired"] == true {
        db::execute(
            &tx,
            "UPDATE collection_invites SET status='expired' WHERE id=$1::uuid",
            vec![db::string(&invite, "id").into()],
        )
        .await?;
        tx.commit().await?;
        return Err(error("BAD_REQUEST", "Invite has expired"));
    }
    if invite["inviter"] == session.user.id {
        return Err(error("BAD_REQUEST", "You cannot accept your own invite"));
    }
    let source = db::rows(
        &tx,
        "SELECT collection_id::text AS id FROM collection_members WHERE user_id=$1",
        vec![session.user.id.clone().into()],
    )
    .await?
    .into_iter()
    .next()
    .ok_or_else(|| error("NOT_FOUND", "Collection membership not found"))?;
    let source = db::string(&source, "id");
    let target = db::string(&invite, "collection");
    if source == target {
        return Err(error(
            "CONFLICT",
            "You are already a member of this collection",
        ));
    }
    db::rows(
        &tx,
        "SELECT id FROM collections WHERE id::text=ANY($1::text[]) ORDER BY id FOR UPDATE",
        vec![vec![source.to_owned(), target.to_owned()].into()],
    )
    .await?;
    if member_count(&tx, target).await? >= 2 {
        return Err(error("CONFLICT", "This collection already has 2 members"));
    }
    if member_count(&tx, source).await? >= 2 {
        return Err(error(
            "CONFLICT",
            "Leave your current shared collection before joining another",
        ));
    }
    let mode = db::string(&input, "mode");
    if mode == "use_theirs" {
        db::execute(&tx,"INSERT INTO collection_audit_events(collection_id,actor_user_id,action,variant_number,condition,language,is_foil,quantity_before,quantity_after,quantity_delta,metadata) SELECT collection_id,$2,'share_discard',variant_number,condition,language,is_foil,quantity,0,-quantity,jsonb_build_object('mode',$3::text,'targetCollectionId',$4::text) FROM collection_items WHERE collection_id=$1::uuid",vec![source.into(),session.user.id.clone().into(),mode.into(),target.into()]).await?;
    } else {
        db::execute(&tx,"INSERT INTO collection_audit_events(collection_id,actor_user_id,action,variant_number,condition,language,is_foil,quantity_before,quantity_after,quantity_delta,metadata) SELECT $2::uuid,$3,'share_merge',i.variant_number,i.condition,i.language,i.is_foil,coalesce(t.quantity,0),coalesce(t.quantity,0)+i.quantity,i.quantity,jsonb_build_object('mode',$4::text,'sourceCollectionId',$1::text) FROM collection_items i LEFT JOIN collection_items t ON t.collection_id=$2::uuid AND t.variant_number=i.variant_number AND t.condition=i.condition AND t.language=i.language AND t.is_foil=i.is_foil WHERE i.collection_id=$1::uuid",vec![source.into(),target.into(),session.user.id.clone().into(),mode.into()]).await?;
        db::execute(&tx,"INSERT INTO collection_items(collection_id,variant_number,quantity,condition,language,is_foil,notes,is_graded,grade_company,grade_score,acquired_at,acquired_price_cents) SELECT $2::uuid,variant_number,quantity,condition,language,is_foil,notes,is_graded,grade_company,grade_score,acquired_at,acquired_price_cents FROM collection_items WHERE collection_id=$1::uuid ON CONFLICT(collection_id,variant_number,condition,language,is_foil) DO UPDATE SET quantity=collection_items.quantity+EXCLUDED.quantity,updated_at=now()",vec![source.into(),target.into()]).await?;
    }
    db::execute(
        &tx,
        "DELETE FROM collection_items WHERE collection_id=$1::uuid",
        vec![source.into()],
    )
    .await?;
    db::execute(&tx,"UPDATE collection_members SET collection_id=$2::uuid,role='member',joined_at=now() WHERE user_id=$1",vec![session.user.id.clone().into(),target.into()]).await?;
    db::execute(
        &tx,
        "DELETE FROM collections WHERE id=$1::uuid",
        vec![source.into()],
    )
    .await?;
    db::execute(
        &tx,
        "UPDATE collection_invites SET status='accepted' WHERE id=$1::uuid",
        vec![db::string(&invite, "id").into()],
    )
    .await?;
    db::execute(&tx,"UPDATE collection_invites SET status='revoked' WHERE collection_id=$1::uuid AND status='pending'",vec![target.into()]).await?;
    db::execute(
        &tx,
        "UPDATE collections SET updated_at=now() WHERE id=$1::uuid",
        vec![target.into()],
    )
    .await?;
    let result = status(&tx, &session.user.id, target).await?;
    tx.commit().await?;
    http::respond("CollectionShareAcceptResponse", json!({"data":result}))
}
#[utoipa::path(post,path="/api/v1/collection/share/leave",operation_id="leaveSharedCollection",responses((status=200,body=astral_grove_api_types::CollectionShareLeaveResponse)))]
async fn leave(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<astral_grove_api_types::CollectionShareLeaveResponse>> {
    membership::ensure(&state, &session.user.id).await?;
    let tx = state.db.begin().await?;
    db::execute(&tx, "SELECT pg_advisory_xact_lock(1280472986)", vec![]).await?;
    let membership = db::rows(
        &tx,
        "SELECT collection_id::text AS id FROM collection_members WHERE user_id=$1",
        vec![session.user.id.clone().into()],
    )
    .await?
    .into_iter()
    .next()
    .ok_or_else(|| error("NOT_FOUND", "Collection membership not found"))?;
    let previous = db::string(&membership, "id");
    db::rows(
        &tx,
        "SELECT id FROM collections WHERE id=$1::uuid FOR UPDATE",
        vec![previous.into()],
    )
    .await?;
    if member_count(&tx, previous).await? < 2 {
        return Err(error("BAD_REQUEST", "You are not in a shared collection"));
    }
    let collection = uuid::Uuid::new_v4().to_string();
    db::execute(
        &tx,
        "INSERT INTO collections(id) VALUES($1::uuid)",
        vec![collection.clone().into()],
    )
    .await?;
    db::execute(&tx,"INSERT INTO collection_audit_events(collection_id,actor_user_id,action,metadata) VALUES($1::uuid,$2,'share_leave',jsonb_build_object('previousCollectionId',$3::text))",vec![collection.clone().into(),session.user.id.clone().into(),previous.into()]).await?;
    db::execute(&tx,"UPDATE collection_members SET collection_id=$2::uuid,role='owner',joined_at=now() WHERE user_id=$1",vec![session.user.id.clone().into(),collection.clone().into()]).await?;
    db::execute(&tx,"UPDATE collection_invites SET status='revoked' WHERE collection_id=$1::uuid AND status='pending' AND inviter_user_id=$2",vec![previous.into(),session.user.id.clone().into()]).await?;
    let result = status(&tx, &session.user.id, &collection).await?;
    tx.commit().await?;
    http::respond("CollectionShareLeaveResponse", json!({"data":result}))
}
pub fn router() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new()
        .routes(routes!(get_status))
        .routes(routes!(invite))
        .routes(routes!(revoke))
        .routes(routes!(preview))
        .routes(routes!(accept))
        .routes(routes!(leave))
}
