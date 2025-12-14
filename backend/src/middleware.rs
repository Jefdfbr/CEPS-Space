use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
use futures_util::future::LocalBoxFuture;
use std::future::{ready, Ready};
use jsonwebtoken::{decode, DecodingKey, Validation};
use sqlx::PgPool;

use crate::models::{Claims, User};

pub struct Auth;

impl<S, B> Transform<S, ServiceRequest> for Auth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddleware { service }))
    }
}

pub struct AuthMiddleware<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for AuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

        let token = req
            .headers()
            .get("Authorization")
            .and_then(|h| h.to_str().ok())
            .and_then(|h| {
                if h.starts_with("Bearer ") {
                    Some(h[7..].to_string())
                } else {
                    None
                }
            });

        if let Some(token) = token {
            match decode::<Claims>(
                &token,
                &DecodingKey::from_secret(jwt_secret.as_bytes()),
                &Validation::default(),
            ) {
                Ok(token_data) => {
                    req.extensions_mut().insert(token_data.claims.sub);
                    let fut = self.service.call(req);
                    Box::pin(async move {
                        let res = fut.await?;
                        Ok(res)
                    })
                }
                Err(_) => {
                    Box::pin(async move {
                        Err(actix_web::error::ErrorUnauthorized("Invalid token"))
                    })
                }
            }
        } else {
            Box::pin(async move {
                Err(actix_web::error::ErrorUnauthorized("No token provided"))
            })
        }
    }
}

// Admin Auth Middleware
pub struct AdminAuth;

impl<S, B> Transform<S, ServiceRequest> for AdminAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = AdminAuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AdminAuthMiddleware { service }))
    }
}

pub struct AdminAuthMiddleware<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for AdminAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

        let token = req
            .headers()
            .get("Authorization")
            .and_then(|h| h.to_str().ok())
            .and_then(|h| {
                if h.starts_with("Bearer ") {
                    Some(h[7..].to_string())
                } else {
                    None
                }
            });

        if let Some(token) = token {
            match decode::<Claims>(
                &token,
                &DecodingKey::from_secret(jwt_secret.as_bytes()),
                &Validation::default(),
            ) {
                Ok(token_data) => {
                    let user_id = token_data.claims.sub;
                    req.extensions_mut().insert(user_id);

                    // Get pool from app data
                    let pool = req.app_data::<actix_web::web::Data<PgPool>>().unwrap().clone();

                    let fut = self.service.call(req);
                    Box::pin(async move {
                        // Check if user is admin
                        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
                            .bind(user_id)
                            .fetch_one(pool.get_ref())
                            .await;

                        match user {
                            Ok(u) if u.is_admin => {
                                let res = fut.await?;
                                Ok(res)
                            }
                            Ok(_) => Err(actix_web::error::ErrorForbidden("Admin access required")),
                            Err(_) => Err(actix_web::error::ErrorUnauthorized("User not found")),
                        }
                    })
                }
                Err(_) => {
                    Box::pin(async move {
                        Err(actix_web::error::ErrorUnauthorized("Invalid token"))
                    })
                }
            }
        } else {
            Box::pin(async move {
                Err(actix_web::error::ErrorUnauthorized("No token provided"))
            })
        }
    }
}
