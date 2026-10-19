use crate::{
    AppState, db,
    error::{AppError, Result},
};
use sea_orm::TransactionTrait;

pub async fn ensure(state: &AppState, user_id: &str) -> Result<String> {
    const MEMBERSHIP: &str =
        "SELECT collection_id::text AS id FROM collection_members WHERE user_id=$1";
    if let Some(row) = db::rows(&state.db, MEMBERSHIP, vec![user_id.into()])
        .await?
        .first()
    {
        return Ok(db::string(row, "id").to_owned());
    }
    let tx = state.db.begin().await?;
    let user = db::rows(
        &tx,
        "SELECT id FROM \"user\" WHERE id=$1 FOR UPDATE",
        vec![user_id.into()],
    )
    .await?;
    if user.is_empty() {
        return Err(AppError::unauthorized());
    }
    let existing = db::rows(&tx, MEMBERSHIP, vec![user_id.into()]).await?;
    let id = if let Some(row) = existing.first() {
        db::string(row, "id").to_owned()
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        db::execute(
            &tx,
            "INSERT INTO collections(id) VALUES($1::uuid)",
            vec![id.clone().into()],
        )
        .await?;
        db::execute(&tx,"INSERT INTO collection_members(collection_id,user_id,role) VALUES($1::uuid,$2,'owner')",vec![id.clone().into(),user_id.into()]).await?;
        id
    };
    tx.commit().await?;
    Ok(id)
}
