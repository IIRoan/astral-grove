export interface paths {
  '/': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['root'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/account-info': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['accountInfo'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/callback/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['callbackOAuth'];
    put?: never;
    post: operations['callbackOAuthPost'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/change-email': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['changeEmail'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/change-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['changePassword'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/delete-user': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['deleteUser'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/delete-user/callback': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['deleteUserCallback'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/email-otp/change-email': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['changeEmailEmailOTP'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/email-otp/check-verification-otp': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['checkVerificationOTP'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/email-otp/request-email-change': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['requestEmailChangeEmailOTP'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/email-otp/request-password-reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['requestPasswordResetEmailOTP'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/email-otp/reset-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['resetPasswordEmailOTP'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/email-otp/send-verification-otp': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['sendVerificationOTP'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/email-otp/verify-email': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['verifyEmailOTP'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/error': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['error'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/expo-authorization-proxy': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['expoAuthorizationProxy'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/forget-password/email-otp': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['forgetPasswordEmailOTP'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/get-access-token': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['getAccessToken'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/get-session': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getSession'];
    put?: never;
    post: operations['getSessionPost'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/link-social': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['linkSocialAccount'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/list-accounts': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listUserAccounts'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/list-sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listSessions'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/ok': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['ok'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/refresh-token': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['refreshToken'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/request-password-reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['requestPasswordReset'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/reset-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['resetPassword'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/reset-password/{token}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['requestPasswordResetCallback'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/revoke-other-sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['revokeOtherSessions'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/revoke-session': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['revokeSession'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/revoke-sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['revokeSessions'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/send-verification-email': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['sendVerificationEmail'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/sign-in/email': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['signInEmail'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/sign-in/email-otp': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['signInEmailOTP'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/sign-in/social': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['signInSocial'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/sign-out': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['signOut'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/sign-up/email': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['signUpEmail'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/unlink-account': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['unlinkAccount'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/update-session': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['updateSession'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/update-user': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['updateUser'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/verify-email': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['verifyEmail'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/verify-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['verifyPassword'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/cards': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listCards'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/cards/batch': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['batchCards'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/cards/index': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getCatalogIndex'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/cards/{variantNumber}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getCard'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listCollection'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/activity-history': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['collectionActivityHistory'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/audit': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listCollectionAudit'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/audit/me': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listPersonalCollectionAudit'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/batch': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['syncCollectionBatch'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/events': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['collectionEvents'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/export': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['exportCollection'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/import': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['importCollection'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/import/preview': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['previewCollectionImport'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/quantities': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['collectionQuantities'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/recent-adds': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['recentCollectionActivity'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/share': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['collectionSharingStatus'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/share/invite': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['createCollectionInvite'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/share/invite/revoke': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['revokeCollectionInvite'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/share/invite/{token}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['previewCollectionInvite'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/share/invite/{token}/accept': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['acceptCollectionInvite'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/share/leave': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['leaveSharedCollection'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/{variantNumber}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['setCollectionItem'];
    post?: never;
    delete: operations['deleteCollectionItem'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/{variantNumber}/add': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['addCollectionItem'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/collection/{variantNumber}/remove': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['removeCollectionItem'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/deck-rules': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getDeckRules'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/deck-rules/validate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['validateDeck'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/decks': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listDecks'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/decks/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getDeck'];
    put: operations['saveDeck'];
    post?: never;
    delete: operations['deleteDeck'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/decks/{id}/import': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['importDeck'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/decks/{id}/versions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['createDeckVersion'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/decks/{id}/versions/{versionId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['saveDeckVersion'];
    post?: never;
    delete: operations['deleteDeckVersion'];
    options?: never;
    head?: never;
    patch: operations['renameDeckVersion'];
    trace?: never;
  };
  '/api/v1/decks/{id}/versions/{versionId}/activate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['activateDeckVersion'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/filters': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['catalogFilters'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/wishlist/{variantNumber}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['setWishlistItem'];
    post?: never;
    delete: operations['deleteWishlistItem'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/prices': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listPrices'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/prices/history': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getPriceHistory'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/prices/stats/batch': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['getPriceStats'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/releases/{filename}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['downloadInternalRelease'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head: operations['headInternalRelease'];
    patch?: never;
    trace?: never;
  };
  '/api/v1/search': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['globalSearch'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/settings/{device}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getUserSettings'];
    put: operations['setUserSettings'];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/sync/catalog': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['syncCatalog'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/sync/prices': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['syncPrices'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/sync/status': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getSyncStatus'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/wishlist': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listWishlist'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/images/{key}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getImage'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    /** @enum {string} */
    CardCondition:
      | 'mint'
      | 'near_mint'
      | 'lightly_played'
      | 'moderately_played'
      | 'heavily_played'
      | 'damaged'
      | 'unspecified';
    CardDetail: {
      id: string;
      name: string;
      type: string;
      super: string | null;
      description: string;
      energy: number;
      might: number;
      power: number;
      tags: string[];
      colors: {
        id: string;
        name: string;
        hexCode?: string;
        /** Format: uri */
        imageUrl?: string;
      }[];
      variants: {
        id: string;
        variantNumber: string;
        rarity: string;
        variantType: string;
        variantLabel: string;
        foilMode: string;
        /** Format: uri */
        imageUrl: string;
        cardmarketId: number | null;
        tcgplayerId: number | null;
        releaseDate: string | null;
        artist: string | null;
        prices: {
          /** @enum {string} */
          currency: 'EUR';
          low: number | null;
          market: number | null;
          avg7d: number | null;
          isFoil: boolean;
        }[];
      }[];
      banEffectiveDate: string | null;
    };
    CardDetailResponse: {
      data: {
        id: string;
        name: string;
        type: string;
        super: string | null;
        description: string;
        energy: number;
        might: number;
        power: number;
        tags: string[];
        colors: {
          id: string;
          name: string;
          hexCode?: string;
          /** Format: uri */
          imageUrl?: string;
        }[];
        variants: {
          id: string;
          variantNumber: string;
          rarity: string;
          variantType: string;
          variantLabel: string;
          foilMode: string;
          /** Format: uri */
          imageUrl: string;
          cardmarketId: number | null;
          tcgplayerId: number | null;
          releaseDate: string | null;
          artist: string | null;
          prices: {
            /** @enum {string} */
            currency: 'EUR';
            low: number | null;
            market: number | null;
            avg7d: number | null;
            isFoil: boolean;
          }[];
        }[];
        banEffectiveDate: string | null;
      };
      meta: {
        /** @enum {string} */
        source: 'cache' | 'upstream' | 'cache-refreshed';
        contentHash: string;
      };
    };
    CardDetailResponseMeta: {
      contentHash: string;
      source: components['schemas']['CardDetailResponseMetaSource'];
    };
    /** @enum {string} */
    CardDetailResponseMetaSource: 'cache' | 'upstream' | 'cache-refreshed';
    CardListItem: {
      cardId: string;
      variantNumber: string;
      name: string;
      type: string;
      super?: string | null;
      variantType?: string;
      energy: number;
      might: number;
      power: number;
      rarity: string;
      setCode: string;
      colors: string[];
      /** Format: uri */
      imageUrl: string;
      cardmarketId: number | null;
      priceEur: {
        /** @enum {string} */
        currency: 'EUR';
        low: number | null;
        market: number | null;
        avg7d: number | null;
        isFoil: boolean;
      } | null;
      printings: {
        variantNumber: string;
        variantLabel: string;
        isFoil: boolean;
        foilMode?: string;
        priceEur: {
          /** @enum {string} */
          currency: 'EUR';
          low: number | null;
          market: number | null;
          avg7d: number | null;
          isFoil: boolean;
        } | null;
      }[];
      isBanned: boolean;
    };
    CardListPrinting: {
      variantNumber: string;
      variantLabel: string;
      isFoil: boolean;
      foilMode?: string;
      priceEur: {
        /** @enum {string} */
        currency: 'EUR';
        low: number | null;
        market: number | null;
        avg7d: number | null;
        isFoil: boolean;
      } | null;
    };
    CardsBatchRequest: {
      variantNumbers: string[];
    };
    CardsBatchResponse: {
      data: {
        id: string;
        name: string;
        type: string;
        super: string | null;
        description: string;
        energy: number;
        might: number;
        power: number;
        tags: string[];
        colors: {
          id: string;
          name: string;
          hexCode?: string;
          /** Format: uri */
          imageUrl?: string;
        }[];
        variants: {
          id: string;
          variantNumber: string;
          rarity: string;
          variantType: string;
          variantLabel: string;
          foilMode: string;
          /** Format: uri */
          imageUrl: string;
          cardmarketId: number | null;
          tcgplayerId: number | null;
          releaseDate: string | null;
          artist: string | null;
          prices: {
            /** @enum {string} */
            currency: 'EUR';
            low: number | null;
            market: number | null;
            avg7d: number | null;
            isFoil: boolean;
          }[];
        }[];
        banEffectiveDate: string | null;
      }[];
      meta: {
        found: number;
        notFound: string[];
        /** @enum {string} */
        source: 'cache' | 'mixed' | 'upstream';
      };
    };
    CardsBatchResponseMeta: {
      /** Format: int64 */
      found: number;
      notFound: string[];
      source: components['schemas']['CardsBatchResponseMetaSource'];
    };
    /** @enum {string} */
    CardsBatchResponseMetaSource: 'cache' | 'mixed' | 'upstream';
    CardsDetailQuery: {
      refresh?: boolean;
    };
    CardsListQuery: {
      q?: string;
      sets?: string;
      colors?: string;
      /**
       * @default all
       * @enum {string}
       */
      colorMode: 'all' | 'within';
      types?: string;
      super?: string;
      variants?: string;
      rarities?: string;
      energyMin?: number;
      energyMax?: number;
      powerMin?: number;
      powerMax?: number;
      mightMin?: number;
      mightMax?: number;
      /** @default 1 */
      page: number;
      /** @default 50 */
      limit: number;
      /**
       * @default name
       * @enum {string}
       */
      sortBy: 'name' | 'energy' | 'variantNumber' | 'releaseDate' | 'price';
      /**
       * @default asc
       * @enum {string}
       */
      dir: 'asc' | 'desc';
      refresh?: boolean;
      excludeTokens?: boolean;
    };
    /** @enum {string} */
    CardsListQueryColorMode: 'all' | 'within';
    /** @enum {string} */
    CardsListQueryDir: 'asc' | 'desc';
    /** @enum {string} */
    CardsListQuerySortBy: 'name' | 'energy' | 'variantNumber' | 'releaseDate' | 'price';
    CardsListResponse: {
      data: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super?: string | null;
        variantType?: string;
        energy: number;
        might: number;
        power: number;
        rarity: string;
        setCode: string;
        colors: string[];
        /** Format: uri */
        imageUrl: string;
        cardmarketId: number | null;
        priceEur: {
          /** @enum {string} */
          currency: 'EUR';
          low: number | null;
          market: number | null;
          avg7d: number | null;
          isFoil: boolean;
        } | null;
        printings: {
          variantNumber: string;
          variantLabel: string;
          isFoil: boolean;
          foilMode?: string;
          priceEur: {
            /** @enum {string} */
            currency: 'EUR';
            low: number | null;
            market: number | null;
            avg7d: number | null;
            isFoil: boolean;
          } | null;
        }[];
        isBanned: boolean;
      }[];
      meta: {
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNext: boolean;
          hasPrevious?: boolean;
        };
        /** @enum {string} */
        source: 'cache' | 'mixed' | 'upstream';
        catalogHash: string;
      };
    };
    CardsListResponseMeta: {
      catalogHash: string;
      pagination: components['schemas']['Pagination'];
      source: components['schemas']['CardsListResponseMetaSource'];
    };
    /** @enum {string} */
    CardsListResponseMetaSource: 'cache' | 'mixed' | 'upstream';
    CatalogIndexResponse: {
      data: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super?: string | null;
        variantType?: string;
        energy: number;
        might: number;
        power: number;
        rarity: string;
        setCode: string;
        colors: string[];
        /** Format: uri */
        imageUrl: string;
        cardmarketId: number | null;
        priceEur: {
          /** @enum {string} */
          currency: 'EUR';
          low: number | null;
          market: number | null;
          avg7d: number | null;
          isFoil: boolean;
        } | null;
        printings: {
          variantNumber: string;
          variantLabel: string;
          isFoil: boolean;
          foilMode?: string;
          priceEur: {
            /** @enum {string} */
            currency: 'EUR';
            low: number | null;
            market: number | null;
            avg7d: number | null;
            isFoil: boolean;
          } | null;
        }[];
        isBanned: boolean;
      }[];
      meta: {
        catalogHash: string;
        pricesCatalogHash: string;
        total: number;
        /** @enum {string} */
        source: 'cache';
      };
    };
    CatalogIndexResponseMeta: {
      catalogHash: string;
      pricesCatalogHash: string;
      source: components['schemas']['CatalogIndexResponseMetaSource'];
      /** Format: int64 */
      total: number;
    };
    /** @enum {string} */
    CatalogIndexResponseMetaSource: 'cache';
    /** @enum {string} */
    CatalogLayout: 'grid' | 'list';
    CollectionActivityCursor: {
      /** Format: date-time */
      at: string;
      id: string;
    };
    CollectionActivityEvent: {
      id: string;
      /** Format: date-time */
      at: string;
      /** @enum {string} */
      action:
        | 'add'
        | 'remove'
        | 'upsert'
        | 'delete'
        | 'clear'
        | 'batch'
        | 'import'
        | 'share_merge'
        | 'share_discard'
        | 'share_leave';
      quantityDelta: number;
      quantityAfter: number | null;
      isFoil: boolean | null;
      actor: {
        userId: string;
        name: string | null;
        email: string | null;
      };
    };
    CollectionActivityHistoryRequest: {
      variantNumbers: string[];
      /** @default 20 */
      limit: number;
      cursor?: {
        /** Format: date-time */
        at: string;
        id: string;
      };
    };
    CollectionActivityHistoryResponse: {
      data: {
        id: string;
        /** Format: date-time */
        at: string;
        /** @enum {string} */
        action:
          | 'add'
          | 'remove'
          | 'upsert'
          | 'delete'
          | 'clear'
          | 'batch'
          | 'import'
          | 'share_merge'
          | 'share_discard'
          | 'share_leave';
        quantityDelta: number;
        quantityAfter: number | null;
        isFoil: boolean | null;
        actor: {
          userId: string;
          name: string | null;
          email: string | null;
        };
      }[];
      meta: {
        hasMore: boolean;
        nextCursor: {
          /** Format: date-time */
          at: string;
          id: string;
        } | null;
      };
    };
    CollectionActivityHistoryResponseMeta: {
      hasMore: boolean;
      nextCursor: components['schemas']['CollectionActivityCursor'] | null;
    };
    CollectionAdjustRequest: {
      /** @default 1 */
      delta: number;
      /**
       * @default near_mint
       * @enum {string}
       */
      condition:
        | 'mint'
        | 'near_mint'
        | 'lightly_played'
        | 'moderately_played'
        | 'heavily_played'
        | 'damaged'
        | 'unspecified';
      /** @default en */
      language: string;
      isFoil?: boolean;
    };
    /** @enum {string} */
    CollectionAuditAction:
      | 'add'
      | 'remove'
      | 'upsert'
      | 'delete'
      | 'clear'
      | 'batch'
      | 'import'
      | 'share_merge'
      | 'share_discard'
      | 'share_leave';
    CollectionAuditActor: {
      userId: string;
      name: string | null;
      email: string | null;
    };
    CollectionAuditEvent: {
      id: string;
      collectionId: string | null;
      /** @enum {string} */
      action:
        | 'add'
        | 'remove'
        | 'upsert'
        | 'delete'
        | 'clear'
        | 'batch'
        | 'import'
        | 'share_merge'
        | 'share_discard'
        | 'share_leave';
      variantNumber: string | null;
      condition:
        | (
            | 'mint'
            | 'near_mint'
            | 'lightly_played'
            | 'moderately_played'
            | 'heavily_played'
            | 'damaged'
            | 'unspecified'
          )
        | null;
      language: string | null;
      isFoil: boolean | null;
      quantityBefore: number | null;
      quantityAfter: number | null;
      quantityDelta: number | null;
      metadata: {
        [key: string]: unknown;
      } | null;
      /** Format: date-time */
      createdAt: string;
      actor: {
        userId: string;
        name: string | null;
        email: string | null;
      };
    };
    CollectionAuditListQuery: {
      /** @default 50 */
      limit: number;
      /** Format: date-time */
      before?: string;
      variantNumber?: string;
      actorUserId?: string;
      mine?: boolean;
      /** @enum {string} */
      action?:
        | 'add'
        | 'remove'
        | 'upsert'
        | 'delete'
        | 'clear'
        | 'batch'
        | 'import'
        | 'share_merge'
        | 'share_discard'
        | 'share_leave';
    };
    CollectionAuditListResponse: {
      data: {
        id: string;
        collectionId: string | null;
        /** @enum {string} */
        action:
          | 'add'
          | 'remove'
          | 'upsert'
          | 'delete'
          | 'clear'
          | 'batch'
          | 'import'
          | 'share_merge'
          | 'share_discard'
          | 'share_leave';
        variantNumber: string | null;
        condition:
          | (
              | 'mint'
              | 'near_mint'
              | 'lightly_played'
              | 'moderately_played'
              | 'heavily_played'
              | 'damaged'
              | 'unspecified'
            )
          | null;
        language: string | null;
        isFoil: boolean | null;
        quantityBefore: number | null;
        quantityAfter: number | null;
        quantityDelta: number | null;
        metadata: {
          [key: string]: unknown;
        } | null;
        /** Format: date-time */
        createdAt: string;
        actor: {
          userId: string;
          name: string | null;
          email: string | null;
        };
      }[];
      meta: {
        total: number;
        limit: number;
        hasMore: boolean;
      };
    };
    CollectionAuditListResponseMeta: {
      hasMore: boolean;
      /** Format: int64 */
      limit: number;
      /** Format: int64 */
      total: number;
    };
    CollectionBatchSyncRequest: {
      items: {
        variantNumber: string;
        /** @default 1 */
        quantity: number;
        /**
         * @default near_mint
         * @enum {string}
         */
        condition:
          | 'mint'
          | 'near_mint'
          | 'lightly_played'
          | 'moderately_played'
          | 'heavily_played'
          | 'damaged'
          | 'unspecified';
        /** @default en */
        language: string;
        isFoil?: boolean;
        notes?: string | null;
        isGraded?: boolean;
        gradeCompany?: string | null;
        gradeScore?: string | null;
        acquiredAt?: string | null;
        acquiredPriceCents?: number | null;
      }[];
    };
    CollectionBatchSyncResponse: {
      data: {
        synced: number;
      };
    };
    CollectionBatchSyncResponseData: {
      /** Format: int64 */
      synced: number;
    };
    CollectionDeleteQuery: {
      /**
       * @default near_mint
       * @enum {string}
       */
      condition:
        | 'mint'
        | 'near_mint'
        | 'lightly_played'
        | 'moderately_played'
        | 'heavily_played'
        | 'damaged'
        | 'unspecified';
      /** @default en */
      language: string;
      isFoil?: boolean;
    };
    /** @enum {string} */
    CollectionImportMode: 'set' | 'add';
    CollectionImportPreviewChange: {
      variantNumber: string;
      name: string | null;
      setCode: string | null;
      imageUrl: string | null;
      quantityBefore: number;
      quantityAfter: number;
      quantityDelta: number;
      /** @enum {string} */
      status: 'new' | 'increase' | 'decrease' | 'unchanged';
    };
    CollectionImportPreviewItem: {
      variantNumber: string;
      quantity: number;
      /**
       * @default near_mint
       * @enum {string}
       */
      condition:
        | 'mint'
        | 'near_mint'
        | 'lightly_played'
        | 'moderately_played'
        | 'heavily_played'
        | 'damaged'
        | 'unspecified';
      /** @default en */
      language: string;
      isFoil?: boolean;
    };
    CollectionImportPreviewRequest:
      | {
          tts: string;
        }
      | {
          items: {
            variantNumber: string;
            quantity: number;
            /**
             * @default near_mint
             * @enum {string}
             */
            condition:
              | 'mint'
              | 'near_mint'
              | 'lightly_played'
              | 'moderately_played'
              | 'heavily_played'
              | 'damaged'
              | 'unspecified';
            /** @default en */
            language: string;
            isFoil?: boolean;
          }[];
        };
    CollectionImportPreviewRequestVariant0: {
      tts: string;
    };
    CollectionImportPreviewRequestVariant1: {
      items: components['schemas']['CollectionImportPreviewItem'][];
    };
    CollectionImportPreviewResponse: {
      data: {
        totalTokens: number;
        totalCopies: number;
        uniquePrintings: number;
        unresolvedCount: number;
        newCount: number;
        increasedCount: number;
        decreasedCount: number;
        unchangedCount: number;
        changes: {
          variantNumber: string;
          name: string | null;
          setCode: string | null;
          imageUrl: string | null;
          quantityBefore: number;
          quantityAfter: number;
          quantityDelta: number;
          /** @enum {string} */
          status: 'new' | 'increase' | 'decrease' | 'unchanged';
        }[];
        unresolved: {
          token: string;
          message: string;
        }[];
        items: {
          variantNumber: string;
          quantity: number;
          /**
           * @default near_mint
           * @enum {string}
           */
          condition:
            | 'mint'
            | 'near_mint'
            | 'lightly_played'
            | 'moderately_played'
            | 'heavily_played'
            | 'damaged'
            | 'unspecified';
          /** @default en */
          language: string;
          isFoil?: boolean;
        }[];
      };
    };
    CollectionImportPreviewResponseData: {
      changes: components['schemas']['CollectionImportPreviewChange'][];
      /** Format: int64 */
      decreasedCount: number;
      /** Format: int64 */
      increasedCount: number;
      items: components['schemas']['CollectionImportPreviewItem'][];
      /** Format: int64 */
      newCount: number;
      /** Format: int64 */
      totalCopies: number;
      /** Format: int64 */
      totalTokens: number;
      /** Format: int64 */
      unchangedCount: number;
      /** Format: int64 */
      uniquePrintings: number;
      unresolved: components['schemas']['CollectionImportPreviewResponseDataUnresolvedItem'][];
      /** Format: int64 */
      unresolvedCount: number;
    };
    CollectionImportPreviewResponseDataUnresolvedItem: {
      message: string;
      token: string;
    };
    /** @enum {string} */
    CollectionImportPreviewStatus: 'new' | 'increase' | 'decrease' | 'unchanged';
    CollectionImportRequest: {
      csv?: string;
      tts?: string;
      /**
       * @default set
       * @enum {string}
       */
      mode: 'set' | 'add';
      items?: {
        variantNumber: string;
        quantity: number;
        /**
         * @default near_mint
         * @enum {string}
         */
        condition:
          | 'mint'
          | 'near_mint'
          | 'lightly_played'
          | 'moderately_played'
          | 'heavily_played'
          | 'damaged'
          | 'unspecified';
        /** @default en */
        language: string;
        isFoil?: boolean;
        notes?: string | null;
        isGraded?: boolean;
        gradeCompany?: string | null;
        gradeScore?: string | null;
      }[];
    };
    CollectionImportRequestItemsItem: {
      condition: components['schemas']['CardCondition'];
      gradeCompany?: string | null;
      gradeScore?: string | null;
      isFoil?: boolean | null;
      isGraded?: boolean | null;
      language: string;
      notes?: string | null;
      /** Format: int64 */
      quantity: number;
      variantNumber: string;
    };
    CollectionImportResponse: {
      data: {
        imported: number;
        totalCopies: number;
        rowsProcessed?: number;
        resolvedFromUpstream?: number;
        failedRows: number;
        errors: {
          row: number;
          message: string;
        }[];
      };
    };
    CollectionImportResponseData: {
      errors: components['schemas']['CollectionImportResponseDataErrorsItem'][];
      /** Format: int64 */
      failedRows: number;
      /** Format: int64 */
      imported: number;
      /** Format: int64 */
      resolvedFromUpstream?: number | null;
      /** Format: int64 */
      rowsProcessed?: number | null;
      /** Format: int64 */
      totalCopies: number;
    };
    CollectionImportResponseDataErrorsItem: {
      message: string;
      /** Format: int64 */
      row: number;
    };
    CollectionItem: {
      id: string;
      variantNumber: string;
      quantity: number;
      /** @enum {string} */
      condition:
        | 'mint'
        | 'near_mint'
        | 'lightly_played'
        | 'moderately_played'
        | 'heavily_played'
        | 'damaged'
        | 'unspecified';
      language: string;
      isFoil: boolean;
      notes: string | null;
      isGraded: boolean;
      gradeCompany: string | null;
      gradeScore: string | null;
      acquiredAt: string | null;
      acquiredPriceCents: number | null;
      /** Format: date-time */
      addedAt: string;
      /** Format: date-time */
      updatedAt: string;
      name: string;
      imageUrl: string;
      setCode: string;
      rarity: string;
      type: string | null;
      variantLabel: string;
    };
    CollectionItemResponse: {
      data: {
        id: string;
        variantNumber: string;
        quantity: number;
        /** @enum {string} */
        condition:
          | 'mint'
          | 'near_mint'
          | 'lightly_played'
          | 'moderately_played'
          | 'heavily_played'
          | 'damaged'
          | 'unspecified';
        language: string;
        isFoil: boolean;
        notes: string | null;
        isGraded: boolean;
        gradeCompany: string | null;
        gradeScore: string | null;
        acquiredAt: string | null;
        acquiredPriceCents: number | null;
        /** Format: date-time */
        addedAt: string;
        /** Format: date-time */
        updatedAt: string;
        name: string;
        imageUrl: string;
        setCode: string;
        rarity: string;
        type: string | null;
        variantLabel: string;
      };
    };
    CollectionListResponse: {
      data: {
        id: string;
        variantNumber: string;
        quantity: number;
        /** @enum {string} */
        condition:
          | 'mint'
          | 'near_mint'
          | 'lightly_played'
          | 'moderately_played'
          | 'heavily_played'
          | 'damaged'
          | 'unspecified';
        language: string;
        isFoil: boolean;
        notes: string | null;
        isGraded: boolean;
        gradeCompany: string | null;
        gradeScore: string | null;
        acquiredAt: string | null;
        acquiredPriceCents: number | null;
        /** Format: date-time */
        addedAt: string;
        /** Format: date-time */
        updatedAt: string;
        name: string;
        imageUrl: string;
        setCode: string;
        rarity: string;
        type: string | null;
        variantLabel: string;
      }[];
      meta: {
        total: number;
        totalQuantity: number;
      };
    };
    CollectionListResponseMeta: {
      /** Format: int64 */
      total: number;
      /** Format: int64 */
      totalQuantity: number;
    };
    /** @enum {string} */
    CollectionLiveChangeReason:
      'upsert' | 'add' | 'remove' | 'delete' | 'clear' | 'batch' | 'import';
    CollectionLiveChangedEvent: {
      /** @enum {string} */
      type: 'collection.changed';
      collectionId: string;
      /** @enum {string} */
      reason: 'upsert' | 'add' | 'remove' | 'delete' | 'clear' | 'batch' | 'import';
      actorUserId: string;
      /** Format: date-time */
      at: string;
    };
    CollectionLiveEvent:
      | {
          /** @enum {string} */
          type: 'collection.changed';
          collectionId: string;
          /** @enum {string} */
          reason: 'upsert' | 'add' | 'remove' | 'delete' | 'clear' | 'batch' | 'import';
          actorUserId: string;
          /** Format: date-time */
          at: string;
        }
      | {
          /** @enum {string} */
          type: 'ready';
          collectionId: string;
        }
      | {
          /** @enum {string} */
          type: 'heartbeat';
          /** Format: date-time */
          at: string;
        };
    CollectionLiveHeartbeatEvent: {
      /** @enum {string} */
      type: 'heartbeat';
      /** Format: date-time */
      at: string;
    };
    CollectionLiveReadyEvent: {
      /** @enum {string} */
      type: 'ready';
      collectionId: string;
    };
    CollectionMutationResponse: {
      data: components['schemas']['CollectionItem'] | null;
    };
    CollectionQuantitiesRequest: {
      variantNumbers: string[];
    };
    CollectionQuantitiesResponse: {
      data: {
        variantNumber: string;
        isFoil: boolean;
        quantity: number;
      }[];
    };
    CollectionQuantityRow: {
      variantNumber: string;
      isFoil: boolean;
      quantity: number;
    };
    CollectionRecentAddsResponse: {
      data: {
        id: string;
        /** Format: date-time */
        at: string;
        /** @enum {string} */
        action:
          | 'add'
          | 'remove'
          | 'upsert'
          | 'delete'
          | 'clear'
          | 'batch'
          | 'import'
          | 'share_merge'
          | 'share_discard'
          | 'share_leave';
        quantityDelta: number;
        quantityAfter: number | null;
        isFoil: boolean | null;
        actor: {
          userId: string;
          name: string | null;
          email: string | null;
        };
      }[];
    };
    /** @enum {string} */
    CollectionShareAcceptMode: 'use_theirs' | 'merge';
    CollectionShareAcceptRequest: {
      /** @enum {string} */
      mode: 'use_theirs' | 'merge';
    };
    CollectionShareAcceptResponse: {
      data: {
        shared: boolean;
        memberCount: number;
        collectionId: string;
        /** @enum {string} */
        role: 'owner' | 'member';
        partner: {
          userId: string;
          name: string;
          /** Format: email */
          email: string;
        } | null;
        pendingInvite: {
          /** Format: date-time */
          expiresAt: string;
          token?: string;
          url?: string;
        } | null;
      };
    };
    CollectionShareInviteCreate: {
      token: string;
      url: string;
      /** Format: date-time */
      expiresAt: string;
    };
    CollectionShareInviteCreateResponse: {
      data: {
        token: string;
        url: string;
        /** Format: date-time */
        expiresAt: string;
      };
    };
    CollectionShareInvitePreview: {
      token: string;
      /** Format: date-time */
      expiresAt: string;
      inviter: {
        userId: string;
        name: string;
      };
      theirItemCount: number;
      theirTotalQuantity: number;
      yourItemCount: number;
      yourTotalQuantity: number;
      canAccept: boolean;
      reason: string | null;
    };
    CollectionShareInvitePreviewResponse: {
      data: {
        token: string;
        /** Format: date-time */
        expiresAt: string;
        inviter: {
          userId: string;
          name: string;
        };
        theirItemCount: number;
        theirTotalQuantity: number;
        yourItemCount: number;
        yourTotalQuantity: number;
        canAccept: boolean;
        reason: string | null;
      };
    };
    CollectionShareLeaveResponse: {
      data: {
        shared: boolean;
        memberCount: number;
        collectionId: string;
        /** @enum {string} */
        role: 'owner' | 'member';
        partner: {
          userId: string;
          name: string;
          /** Format: email */
          email: string;
        } | null;
        pendingInvite: {
          /** Format: date-time */
          expiresAt: string;
          token?: string;
          url?: string;
        } | null;
      };
    };
    CollectionSharePartner: {
      userId: string;
      name: string;
      /** Format: email */
      email: string;
    };
    CollectionSharePendingInvite: {
      /** Format: date-time */
      expiresAt: string;
      token?: string;
      url?: string;
    };
    CollectionSharePerson: {
      userId: string;
      name: string;
    };
    CollectionShareStatus: {
      shared: boolean;
      memberCount: number;
      collectionId: string;
      /** @enum {string} */
      role: 'owner' | 'member';
      partner: {
        userId: string;
        name: string;
        /** Format: email */
        email: string;
      } | null;
      pendingInvite: {
        /** Format: date-time */
        expiresAt: string;
        token?: string;
        url?: string;
      } | null;
    };
    CollectionShareStatusResponse: {
      data: {
        shared: boolean;
        memberCount: number;
        collectionId: string;
        /** @enum {string} */
        role: 'owner' | 'member';
        partner: {
          userId: string;
          name: string;
          /** Format: email */
          email: string;
        } | null;
        pendingInvite: {
          /** Format: date-time */
          expiresAt: string;
          token?: string;
          url?: string;
        } | null;
      };
    };
    /** @enum {string} */
    CollectionShareStatusRole: 'owner' | 'member';
    CollectionUpsertRequest: {
      variantNumber: string;
      /** @default 1 */
      quantity: number;
      /**
       * @default near_mint
       * @enum {string}
       */
      condition:
        | 'mint'
        | 'near_mint'
        | 'lightly_played'
        | 'moderately_played'
        | 'heavily_played'
        | 'damaged'
        | 'unspecified';
      /** @default en */
      language: string;
      isFoil?: boolean;
      notes?: string | null;
      isGraded?: boolean;
      gradeCompany?: string | null;
      gradeScore?: string | null;
      acquiredAt?: string | null;
      acquiredPriceCents?: number | null;
    };
    ColorRef: {
      id: string;
      name: string;
      hexCode?: string;
      /** Format: uri */
      imageUrl?: string;
    };
    CreateDeckVersionRequest: {
      name: string;
    };
    DeckCardInput: {
      cardId: string;
      variantNumber: string;
      name: string;
      type: string;
      super: string | null;
      tags: string[];
      colors: string[];
      energy: number;
      power?: number;
      setCode: string;
      rarity: string;
      variantType: string;
      isSignature: boolean;
      imageUrl?: string | null;
      banEffectiveDate?: string | null;
    };
    DeckDetailResponse: {
      data: {
        id: string;
        name: string;
        description?: string;
        /**
         * @default constructed
         * @enum {string}
         */
        format: 'constructed' | 'pre-rift';
        createdAt: number;
        updatedAt: number;
        legend: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        } | null;
        champion: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        } | null;
        mainDeck: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        runes: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        battlefields: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        sideboard: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        upstreamId?: string;
        importedFromId?: string;
        syncWarnings?: string[];
        /** @enum {string} */
        source: 'owned' | 'imported';
        readOnly: boolean;
        authorName?: string;
        views?: number;
        likes?: number;
        isLegal?: boolean;
        setPrefixes?: string[];
        hasGuide?: boolean;
        hasVideo?: boolean;
        hasMatchups?: boolean;
        videoUrl?: string;
        bannedCardNames?: string[];
        versionId?: string;
        versionName?: string;
        versions?: {
          id: string;
          name: string;
          createdAt: number;
          updatedAt: number;
          isActive: boolean;
        }[];
      };
    };
    DeckEntryInput: {
      card: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      };
      count: number;
    };
    /** @enum {string} */
    DeckFormat: 'constructed' | 'pre-rift';
    DeckListItem: {
      id: string;
      name: string;
      description?: string;
      /**
       * @default constructed
       * @enum {string}
       */
      format: 'constructed' | 'pre-rift';
      createdAt: number;
      updatedAt: number;
      legend: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      champion: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      mainDeck: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      runes: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      battlefields: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      sideboard: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      upstreamId?: string;
      importedFromId?: string;
      syncWarnings?: string[];
      /** @enum {string} */
      source: 'owned' | 'imported';
      readOnly: boolean;
      authorName?: string;
      views?: number;
      likes?: number;
      isLegal?: boolean;
      setPrefixes?: string[];
      hasGuide?: boolean;
      hasVideo?: boolean;
      hasMatchups?: boolean;
      videoUrl?: string;
      bannedCardNames?: string[];
      versionId?: string;
      versionName?: string;
      versions?: {
        id: string;
        name: string;
        createdAt: number;
        updatedAt: number;
        isActive: boolean;
      }[];
    };
    DeckListResponse: {
      data: {
        id: string;
        name: string;
        description?: string;
        /**
         * @default constructed
         * @enum {string}
         */
        format: 'constructed' | 'pre-rift';
        createdAt: number;
        updatedAt: number;
        legend: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        } | null;
        champion: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        } | null;
        mainDeck: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        runes: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        battlefields: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        sideboard: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        upstreamId?: string;
        importedFromId?: string;
        syncWarnings?: string[];
        /** @enum {string} */
        source: 'owned' | 'imported';
        readOnly: boolean;
        authorName?: string;
        views?: number;
        likes?: number;
        isLegal?: boolean;
        setPrefixes?: string[];
        hasGuide?: boolean;
        hasVideo?: boolean;
        hasMatchups?: boolean;
        videoUrl?: string;
        bannedCardNames?: string[];
        versionId?: string;
        versionName?: string;
        versions?: {
          id: string;
          name: string;
          createdAt: number;
          updatedAt: number;
          isActive: boolean;
        }[];
      }[];
      meta: {
        total: number;
        owned: number;
        imported: number;
        pagination?: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNext: boolean;
          hasPrevious?: boolean;
        };
      };
    };
    DeckListResponseMeta: {
      /** Format: int64 */
      imported: number;
      /** Format: int64 */
      owned: number;
      pagination?: components['schemas']['Pagination'] | null;
      /** Format: int64 */
      total: number;
    };
    DeckRulesResponse: {
      data: {
        version: string;
        rules: {
          version: string;
          game: string;
          format: string;
          sections: {
            [key: string]: {
              key: string;
              title: string;
              target: number;
              single?: boolean;
              minimum?: number;
              exact?: boolean;
              maximum?: number;
              required: boolean;
              uniqueNames?: boolean;
              description: string;
            };
          };
          copyLimits: {
            default: number | null;
            rune: number;
            battlefieldPerName: number;
            signatureTotal: number | null;
          };
          maxDomains?: number | null;
          requireChampionTagMatch?: boolean;
          requireSignatureTagMatch?: boolean;
          restrictPicker?: boolean;
          constraints: {
            code: string;
            message: string;
          }[];
        };
      };
    };
    DeckRulesResponseData: {
      rules: components['schemas']['DeckRulesResponseDataRules'];
      version: string;
    };
    DeckRulesResponseDataRules: {
      constraints: components['schemas']['DeckRulesResponseDataRulesConstraintsItem'][];
      copyLimits: components['schemas']['DeckRulesResponseDataRulesCopyLimits'];
      format: string;
      game: string;
      /** Format: int64 */
      maxDomains?: number | null;
      requireChampionTagMatch?: boolean | null;
      requireSignatureTagMatch?: boolean | null;
      restrictPicker?: boolean | null;
      sections: {
        [key: string]: components['schemas']['DeckRulesResponseDataRulesSectionsValue'];
      };
      version: string;
    };
    DeckRulesResponseDataRulesConstraintsItem: {
      code: string;
      message: string;
    };
    DeckRulesResponseDataRulesCopyLimits: {
      /** Format: int64 */
      battlefieldPerName: number;
      /** Format: int64 */
      default: number | null;
      /** Format: int64 */
      rune: number;
      /** Format: int64 */
      signatureTotal: number | null;
    };
    DeckRulesResponseDataRulesSectionsValue: {
      description: string;
      exact?: boolean | null;
      key: string;
      /** Format: int64 */
      maximum?: number | null;
      /** Format: int64 */
      minimum?: number | null;
      required: boolean;
      single?: boolean | null;
      /** Format: int64 */
      target: number;
      title: string;
      uniqueNames?: boolean | null;
    };
    /** @enum {string} */
    DeckSortField: 'trending' | 'likes' | 'views' | 'createdAt' | 'editedAt';
    /** @enum {string} */
    DeckSource: 'owned' | 'imported';
    DeckUpsertRequest: {
      id: string;
      name: string;
      description?: string;
      /**
       * @default constructed
       * @enum {string}
       */
      format: 'constructed' | 'pre-rift';
      createdAt: number;
      updatedAt: number;
      legend: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      champion: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      mainDeck: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      runes: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      battlefields: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      sideboard: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      upstreamId?: string;
      importedFromId?: string;
      syncWarnings?: string[];
    };
    DeckValidateInput: {
      /**
       * @default constructed
       * @enum {string}
       */
      format: 'constructed' | 'pre-rift';
      legend: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      champion: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      mainDeck: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      runes: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      battlefields: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      sideboard: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
    };
    DeckValidateResponse: {
      data: {
        messages: {
          /** @enum {string} */
          type: 'error' | 'warning' | 'valid';
          code: string;
          message: string;
        }[];
        valid: boolean;
        hasErrors: boolean;
      };
    };
    DeckValidateResponseData: {
      hasErrors: boolean;
      messages: components['schemas']['DeckValidationMessage'][];
      valid: boolean;
    };
    DeckValidationMessage: {
      /** @enum {string} */
      type: 'error' | 'warning' | 'valid';
      code: string;
      message: string;
    };
    /** @enum {string} */
    DeckValidationMessageType: 'error' | 'warning' | 'valid';
    DeckVersionSummary: {
      id: string;
      name: string;
      createdAt: number;
      updatedAt: number;
      isActive: boolean;
    };
    DecksListQuery: {
      q?: string;
      legend?: string;
      sets?: string;
      isLegal?: boolean;
      hasGuide?: boolean;
      hasVideo?: boolean;
      hasMatchups?: boolean;
      /** @default 1 */
      page: number;
      /** @default 25 */
      limit: number;
      /**
       * @default trending
       * @enum {string}
       */
      sort: 'trending' | 'likes' | 'views' | 'createdAt' | 'editedAt';
      /**
       * @default desc
       * @enum {string}
       */
      dir: 'asc' | 'desc';
      /**
       * @default all
       * @enum {string}
       */
      source: 'owned' | 'imported' | 'all';
      preview?: boolean;
    };
    /** @enum {string} */
    DecksListQueryDir: 'asc' | 'desc';
    /** @enum {string} */
    DecksListQuerySource: 'owned' | 'imported' | 'all';
    FilterSnapshot: {
      colors: {
        id: string;
        name: string;
        count: number;
        imageUrl?: string;
      }[];
      sets: {
        id: string;
        name: string;
        count: number;
        code?: string;
        printCount?: number;
        foilPrintCount?: number;
      }[];
      types: {
        id: string;
        name: string;
        count: number;
      }[];
      supertypes: {
        id: string;
        name: string;
        count: number;
      }[];
      rarities: {
        id: string;
        name: string;
        count: number;
      }[];
      variants: {
        id: string;
        name: string;
        count: number;
      }[];
    };
    FilterSnapshotColorsItem: {
      /** Format: int64 */
      count: number;
      id: string;
      imageUrl?: string | null;
      name: string;
    };
    FilterSnapshotRaritiesItem: {
      /** Format: int64 */
      count: number;
      id: string;
      name: string;
    };
    FilterSnapshotSetsItem: {
      code?: string | null;
      /** Format: int64 */
      count: number;
      /** Format: int64 */
      foilPrintCount?: number | null;
      id: string;
      name: string;
      /** Format: int64 */
      printCount?: number | null;
    };
    FilterSnapshotSupertypesItem: {
      /** Format: int64 */
      count: number;
      id: string;
      name: string;
    };
    FilterSnapshotTypesItem: {
      /** Format: int64 */
      count: number;
      id: string;
      name: string;
    };
    FilterSnapshotVariantsItem: {
      /** Format: int64 */
      count: number;
      id: string;
      name: string;
    };
    FiltersResponse: {
      data: {
        colors: {
          id: string;
          name: string;
          count: number;
          imageUrl?: string;
        }[];
        sets: {
          id: string;
          name: string;
          count: number;
          code?: string;
          printCount?: number;
          foilPrintCount?: number;
        }[];
        types: {
          id: string;
          name: string;
          count: number;
        }[];
        supertypes: {
          id: string;
          name: string;
          count: number;
        }[];
        rarities: {
          id: string;
          name: string;
          count: number;
        }[];
        variants: {
          id: string;
          name: string;
          count: number;
        }[];
      };
      meta: {
        /** Format: date-time */
        cachedAt: string;
        catalogHash: string;
        pricesCatalogHash: string;
        variantCount: number;
      };
    };
    FiltersResponseMeta: {
      cachedAt: components['schemas']['String'];
      catalogHash: string;
      pricesCatalogHash: string;
      /** Format: int64 */
      variantCount: number;
    };
    GlobalSearchQuery: {
      q: string;
      types?: string;
      /** @default 10 */
      limit: number;
      /** @default 1 */
      page: number;
    };
    GlobalSearchResponse: {
      data: {
        cards?: {
          hits: {
            /** @enum {string} */
            kind: 'card';
            variantNumber: string;
            name: string;
            /** Format: uri */
            imageUrl: string;
            setCode: string;
            type: string;
            rarity: string;
            textMatch?: number;
          }[];
          total: number;
        };
        decks?: {
          hits: {
            /** @enum {string} */
            kind: 'deck';
            id: string;
            name: string;
            textMatch?: number;
          }[];
          total: number;
        };
      };
      meta: {
        tookMs: number;
        catalogHash: string;
      };
    };
    GlobalSearchResponseData: {
      cards?: components['schemas']['GlobalSearchResponseDataCards'] | null;
      decks?: components['schemas']['GlobalSearchResponseDataDecks'] | null;
    };
    GlobalSearchResponseDataCards: {
      hits: components['schemas']['SearchHitCard'][];
      /** Format: int64 */
      total: number;
    };
    GlobalSearchResponseDataDecks: {
      hits: components['schemas']['SearchHitDeck'][];
      /** Format: int64 */
      total: number;
    };
    GlobalSearchResponseMeta: {
      catalogHash: string;
      /** Format: int64 */
      tookMs: number;
    };
    /** @enum {string} */
    GridCardSize: 'large' | 'medium' | 'small';
    HealthResponse: {
      data: {
        /** @enum {string} */
        status: 'ok';
        /** @enum {string} */
        db: 'ok' | 'error';
        lastCatalogSync: string | null;
        emailVerificationRequired: boolean;
      };
    };
    HealthResponseData: {
      db: components['schemas']['HealthResponseDataDb'];
      emailVerificationRequired: boolean;
      lastCatalogSync: components['schemas']['String'] | null;
      status: string;
    };
    /** @enum {string} */
    HealthResponseDataDb: 'ok' | 'error';
    IdData: {
      id: string;
    };
    IdResponse: {
      data: {
        id: string;
      };
    };
    ImageThumbQuery: {
      /** @enum {integer} */
      w?: 96 | 160 | 240 | 320;
    };
    OkData: {
      /** @enum {boolean} */
      ok: true;
    };
    OkResponse: {
      data: {
        /** @enum {boolean} */
        ok: true;
      };
    };
    PaCardsBatchResponse: {
      data: {
        id: string;
        variantNumber: string;
        imageUrl: string;
        rarity: string;
        variantType: string;
        foilMode: string;
        variantTypes: string[];
        showInLibrary: boolean;
        isCollectible: boolean;
        variantLabel: string;
        flavorText?: string | null;
        artist?: string | null;
        releaseDate?: string | null;
        cardmarketId?: number | null;
        tcgplayerId?: number | null;
        parentVariantId?: string | null;
        set: {
          id: string;
          name: string;
          prefix: string;
          releaseDate?: string;
        };
        card?: unknown;
      }[];
      notFound: string[];
    };
    PaCardsListResponse: {
      data: {
        id: string;
        variantNumber: string;
        imageUrl: string;
        rarity: string;
        variantType: string;
        foilMode: string;
        variantTypes: string[];
        showInLibrary: boolean;
        isCollectible: boolean;
        variantLabel: string;
        flavorText?: string | null;
        artist?: string | null;
        releaseDate?: string | null;
        cardmarketId?: number | null;
        tcgplayerId?: number | null;
        parentVariantId?: string | null;
        set: {
          id: string;
          name: string;
          prefix: string;
          releaseDate?: string;
        };
        card?: unknown;
      }[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious?: boolean;
      };
      meta?: {
        filters: {
          [key: string]: unknown;
        };
      };
    };
    PaCardsListResponseMeta: {
      filters: {
        [key: string]: unknown;
      };
    };
    PaCardsListResponsePagination: {
      hasNext: boolean;
      hasPrevious?: boolean | null;
      /** Format: int64 */
      limit: number;
      /** Format: int64 */
      page: number;
      /** Format: int64 */
      total: number;
      /** Format: int64 */
      totalPages: number;
    };
    PaColor: {
      id: string;
      name: string;
      hexCode?: string;
      /** Format: uri */
      imageUrl?: string;
    };
    PaLogicalCard: {
      id: string;
      name: string;
      type: string;
      super?: string | null;
      description: string;
      energy: number;
      might: number;
      power: number;
      tags: string[];
      attachText?: string | null;
      effect?: string | null;
      mightBonus?: number;
      maxCopies?: number | null;
      banEffectiveDate?: string | null;
      colors: {
        id: string;
        name: string;
        hexCode?: string;
        /** Format: uri */
        imageUrl?: string;
      }[];
      variants: {
        id: string;
        variantNumber: string;
        imageUrl: string;
        rarity: string;
        variantType: string;
        foilMode: string;
        variantTypes: string[];
        showInLibrary: boolean;
        isCollectible: boolean;
        variantLabel: string;
        flavorText?: string | null;
        artist?: string | null;
        releaseDate?: string | null;
        cardmarketId?: number | null;
        tcgplayerId?: number | null;
        parentVariantId?: string | null;
        set: {
          id: string;
          name: string;
          prefix: string;
          releaseDate?: string;
        };
      }[];
    };
    PaPriceRow: {
      id: string;
      cardmarketId: number;
      tcgPlayerId?: number | null;
      provider: string;
      isFoil: boolean;
      currency: string;
      lowPrice: string | null;
      marketPrice: string | null;
      midPrice: string | null;
      highPrice: string | null;
      directLowPrice?: string | null;
      avg1Day: string | null;
      avg7Day: string | null;
      avg30Day: string | null;
      lastUpdated: string;
    };
    PaPricesListResponse: {
      data: {
        id: string;
        cardmarketId: number;
        tcgPlayerId?: number | null;
        provider: string;
        isFoil: boolean;
        currency: string;
        lowPrice: string | null;
        marketPrice: string | null;
        midPrice: string | null;
        highPrice: string | null;
        directLowPrice?: string | null;
        avg1Day: string | null;
        avg7Day: string | null;
        avg30Day: string | null;
        lastUpdated: string;
      }[];
    };
    PaSet: {
      id: string;
      name: string;
      prefix: string;
      releaseDate?: string;
    };
    PaVariant: {
      id: string;
      variantNumber: string;
      imageUrl: string;
      rarity: string;
      variantType: string;
      foilMode: string;
      variantTypes: string[];
      showInLibrary: boolean;
      isCollectible: boolean;
      variantLabel: string;
      flavorText?: string | null;
      artist?: string | null;
      releaseDate?: string | null;
      cardmarketId?: number | null;
      tcgplayerId?: number | null;
      parentVariantId?: string | null;
      set: {
        id: string;
        name: string;
        prefix: string;
        releaseDate?: string;
      };
    };
    PaVariantListItem: {
      id: string;
      variantNumber: string;
      imageUrl: string;
      rarity: string;
      variantType: string;
      foilMode: string;
      variantTypes: string[];
      showInLibrary: boolean;
      isCollectible: boolean;
      variantLabel: string;
      flavorText?: string | null;
      artist?: string | null;
      releaseDate?: string | null;
      cardmarketId?: number | null;
      tcgplayerId?: number | null;
      parentVariantId?: string | null;
      set: {
        id: string;
        name: string;
        prefix: string;
        releaseDate?: string;
      };
      card?: unknown;
    };
    Pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious?: boolean;
    };
    PriceDailyPoint: {
      cardmarketId: number;
      isFoil: boolean;
      /** @enum {string} */
      provider: 'cardmarket';
      /** @enum {string} */
      currency: 'EUR';
      priceDate: string;
      lowPrice: number | null;
      marketPrice: number | null;
      midPrice: number | null;
      highPrice: number | null;
    };
    PriceHistoryQuery: {
      cardmarketId?: number;
      variantNumber?: string;
      isFoil?: boolean;
      /** @default 30 */
      days: number;
    };
    PriceHistoryResponse: {
      data: {
        cardmarketId: number;
        isFoil: boolean;
        /** @enum {string} */
        provider: 'cardmarket';
        /** @enum {string} */
        currency: 'EUR';
        priceDate: string;
        lowPrice: number | null;
        marketPrice: number | null;
        midPrice: number | null;
        highPrice: number | null;
      }[];
      meta: {
        cardmarketId: number | null;
        isFoil: boolean | null;
        days: number;
        rowCount: number;
      };
    };
    PriceHistoryResponseMeta: {
      /** Format: int64 */
      cardmarketId: number | null;
      /** Format: int64 */
      days: number;
      isFoil: boolean | null;
      /** Format: int64 */
      rowCount: number;
    };
    PriceRow: {
      id: string;
      cardmarketId: number;
      isFoil: boolean;
      /** @enum {string} */
      provider: 'cardmarket';
      /** @enum {string} */
      currency: 'EUR';
      lowPrice: number | null;
      marketPrice: number | null;
      midPrice: number | null;
      highPrice: number | null;
      avg1Day: number | null;
      avg7Day: number | null;
      avg30Day: number | null;
      /** Format: date-time */
      lastUpdated: string;
    };
    PriceStats: {
      variantNumber: string;
      cardmarketId: number | null;
      isFoil: boolean;
      /** @enum {string} */
      currency: 'EUR';
      currentPrice: number | null;
      baselinePrice: number | null;
      minPrice: number | null;
      maxPrice: number | null;
      avgPrice: number | null;
      listingLow: number | null;
      changePercent: number | null;
      /** @enum {string} */
      trend: 'up' | 'down' | 'flat';
      points: {
        cardmarketId: number;
        isFoil: boolean;
        /** @enum {string} */
        provider: 'cardmarket';
        /** @enum {string} */
        currency: 'EUR';
        priceDate: string;
        lowPrice: number | null;
        marketPrice: number | null;
        midPrice: number | null;
        highPrice: number | null;
      }[];
      days: number;
      priceFilterLabel: string;
      priceSourceNote: string;
      targetPriceCents?: number | null;
      belowTarget?: boolean;
    };
    PriceStatsBatchRequest: {
      items: {
        variantNumber: string;
        isFoil?: boolean;
        targetPriceCents?: number | null;
      }[];
      /** @default 30 */
      days: number;
    };
    PriceStatsBatchRequestItemsItem: {
      isFoil?: boolean | null;
      /** Format: int64 */
      targetPriceCents?: number | null;
      variantNumber: string;
    };
    PriceStatsBatchResponse: {
      data: {
        variantNumber: string;
        cardmarketId: number | null;
        isFoil: boolean;
        /** @enum {string} */
        currency: 'EUR';
        currentPrice: number | null;
        baselinePrice: number | null;
        minPrice: number | null;
        maxPrice: number | null;
        avgPrice: number | null;
        listingLow: number | null;
        changePercent: number | null;
        /** @enum {string} */
        trend: 'up' | 'down' | 'flat';
        points: {
          cardmarketId: number;
          isFoil: boolean;
          /** @enum {string} */
          provider: 'cardmarket';
          /** @enum {string} */
          currency: 'EUR';
          priceDate: string;
          lowPrice: number | null;
          marketPrice: number | null;
          midPrice: number | null;
          highPrice: number | null;
        }[];
        days: number;
        priceFilterLabel: string;
        priceSourceNote: string;
        targetPriceCents?: number | null;
        belowTarget?: boolean;
      }[];
      meta: {
        days: number;
        rowCount: number;
      };
    };
    PriceStatsBatchResponseMeta: {
      /** Format: int64 */
      days: number;
      /** Format: int64 */
      rowCount: number;
    };
    PriceSummary: {
      /** @enum {string} */
      currency: 'EUR';
      low: number | null;
      market: number | null;
      avg7d: number | null;
      isFoil: boolean;
    };
    /** @enum {string} */
    PriceTrend: 'up' | 'down' | 'flat';
    PricesListQuery: {
      cardmarketId?: number;
      variantNumber?: string;
      isFoil?: boolean;
    };
    PricesListResponse: {
      data: {
        id: string;
        cardmarketId: number;
        isFoil: boolean;
        /** @enum {string} */
        provider: 'cardmarket';
        /** @enum {string} */
        currency: 'EUR';
        lowPrice: number | null;
        marketPrice: number | null;
        midPrice: number | null;
        highPrice: number | null;
        avg1Day: number | null;
        avg7Day: number | null;
        avg30Day: number | null;
        /** Format: date-time */
        lastUpdated: string;
      }[];
      meta: {
        pricesCatalogHash: string;
        lastSyncedAt: string | null;
        rowCount: number;
      };
    };
    PricesListResponseMeta: {
      lastSyncedAt: components['schemas']['String'] | null;
      pricesCatalogHash: string;
      /** Format: int64 */
      rowCount: number;
    };
    RenameDeckVersionRequest: {
      name: string;
    };
    /** @enum {string} */
    SearchEntityType: 'cards' | 'decks' | 'navigation' | 'actions';
    SearchHitCard: {
      /** @enum {string} */
      kind: 'card';
      variantNumber: string;
      name: string;
      /** Format: uri */
      imageUrl: string;
      setCode: string;
      type: string;
      rarity: string;
      textMatch?: number;
    };
    SearchHitDeck: {
      /** @enum {string} */
      kind: 'deck';
      id: string;
      name: string;
      textMatch?: number;
    };
    Session: {
      createdAt: string;
      expiresAt: string;
      id: string;
      ipAddress: string | null;
      token: string;
      updatedAt: string;
      userAgent: string | null;
      userId: string;
    };
    SessionResponse: {
      session: components['schemas']['Session'];
      user: components['schemas']['User'];
    };
    /** @enum {string} */
    SettingsDeviceProfile: 'phone' | 'desktop';
    SignInResponse: {
      redirect: boolean;
      token: string;
      url?: string | null;
      user: components['schemas']['User'];
    };
    SignUpResponse: {
      token: string | null;
      user: components['schemas']['User'];
    };
    String: string;
    SyncCatalogResponse: {
      data: {
        changed: boolean;
        pages: number;
        variantCount: number;
        hash: string;
      };
    };
    SyncCatalogResponseData: {
      changed: boolean;
      hash: string;
      /** Format: int64 */
      pages: number;
      /** Format: int64 */
      variantCount: number;
    };
    SyncPricesResponse: {
      data: {
        changed: boolean;
        rowCount: number;
        productCount: number;
        hash: string;
        /** @enum {string} */
        source: 'cardmarket';
        gameId: number;
        exportCreatedAt: string;
        cardmarketIdsBackfilled: number;
      };
    };
    SyncPricesResponseData: {
      /** Format: int64 */
      cardmarketIdsBackfilled: number;
      changed: boolean;
      exportCreatedAt: string;
      /** Format: int64 */
      gameId: number;
      hash: string;
      /** Format: int64 */
      productCount: number;
      /** Format: int64 */
      rowCount: number;
      source: string;
    };
    SyncStatusResponse: {
      data: {
        catalog: {
          lastRun: string | null;
          /** @enum {string} */
          status: 'idle' | 'running' | 'failed';
          hash: string;
          variantCount: number;
        };
        prices: {
          lastRun: string | null;
          /** @enum {string} */
          status: 'idle' | 'running' | 'failed';
          hash: string;
          rowCount: number;
        };
      };
    };
    SyncStatusResponseData: {
      catalog: components['schemas']['SyncStatusResponseDataCatalog'];
      prices: components['schemas']['SyncStatusResponseDataPrices'];
    };
    SyncStatusResponseDataCatalog: {
      hash: string;
      lastRun: components['schemas']['String'] | null;
      status: components['schemas']['SyncStatusResponseDataCatalogStatus'];
      /** Format: int64 */
      variantCount: number;
    };
    /** @enum {string} */
    SyncStatusResponseDataCatalogStatus: 'idle' | 'running' | 'failed';
    SyncStatusResponseDataPrices: {
      hash: string;
      lastRun: components['schemas']['String'] | null;
      /** Format: int64 */
      rowCount: number;
      status: components['schemas']['SyncStatusResponseDataPricesStatus'];
    };
    /** @enum {string} */
    SyncStatusResponseDataPricesStatus: 'idle' | 'running' | 'failed';
    /** @enum {string} */
    ThemePreference: 'light' | 'dark' | 'system';
    User: {
      createdAt: string;
      email: string;
      emailVerified: boolean;
      id: string;
      image: string | null;
      name: string;
      updatedAt: string;
    };
    UserSettings: {
      /** @enum {string} */
      device: 'phone' | 'desktop';
      settings: {
        /** @enum {string} */
        theme: 'light' | 'dark' | 'system';
        accentColor?: string;
        /** @enum {string} */
        defaultLayout: 'grid' | 'list';
        /** @enum {string} */
        gridCardSize: 'large' | 'medium' | 'small';
      };
      updatedAt: string | null;
    };
    UserSettingsPatch: {
      /** @enum {string} */
      theme?: 'light' | 'dark' | 'system';
      accentColor?: string;
      /** @enum {string} */
      defaultLayout?: 'grid' | 'list';
      /** @enum {string} */
      gridCardSize?: 'large' | 'medium' | 'small';
    };
    UserSettingsPayload: {
      /** @enum {string} */
      theme: 'light' | 'dark' | 'system';
      accentColor?: string;
      /** @enum {string} */
      defaultLayout: 'grid' | 'list';
      /** @enum {string} */
      gridCardSize: 'large' | 'medium' | 'small';
    };
    UserSettingsResponse: {
      data: {
        /** @enum {string} */
        device: 'phone' | 'desktop';
        settings: {
          /** @enum {string} */
          theme: 'light' | 'dark' | 'system';
          accentColor?: string;
          /** @enum {string} */
          defaultLayout: 'grid' | 'list';
          /** @enum {string} */
          gridCardSize: 'large' | 'medium' | 'small';
        };
        updatedAt: string | null;
      };
    };
    VariantDetail: {
      id: string;
      variantNumber: string;
      rarity: string;
      variantType: string;
      variantLabel: string;
      foilMode: string;
      /** Format: uri */
      imageUrl: string;
      cardmarketId: number | null;
      tcgplayerId: number | null;
      releaseDate: string | null;
      artist: string | null;
      prices: {
        /** @enum {string} */
        currency: 'EUR';
        low: number | null;
        market: number | null;
        avg7d: number | null;
        isFoil: boolean;
      }[];
    };
    WishlistItem: {
      id: string;
      variantNumber: string;
      priority: number;
      targetPriceCents: number | null;
      notes: string | null;
      /** Format: date-time */
      addedAt: string;
      name: string;
      imageUrl: string;
      setCode: string;
      rarity: string;
      variantLabel: string;
    };
    WishlistItemResponse: {
      data: {
        id: string;
        variantNumber: string;
        priority: number;
        targetPriceCents: number | null;
        notes: string | null;
        /** Format: date-time */
        addedAt: string;
        name: string;
        imageUrl: string;
        setCode: string;
        rarity: string;
        variantLabel: string;
      };
    };
    WishlistListResponse: {
      data: {
        id: string;
        variantNumber: string;
        priority: number;
        targetPriceCents: number | null;
        notes: string | null;
        /** Format: date-time */
        addedAt: string;
        name: string;
        imageUrl: string;
        setCode: string;
        rarity: string;
        variantLabel: string;
      }[];
      meta: {
        total: number;
      };
    };
    WishlistListResponseMeta: {
      /** Format: int64 */
      total: number;
    };
    WishlistUpsertRequest: {
      variantNumber: string;
      /** @default 0 */
      priority: number;
      targetPriceCents?: number | null;
      notes?: string | null;
    };
    bool: boolean;
    /** @enum {string} */
    CardConditionInput:
      | 'mint'
      | 'near_mint'
      | 'lightly_played'
      | 'moderately_played'
      | 'heavily_played'
      | 'damaged'
      | 'unspecified';
    CardDetailInput: {
      id: string;
      name: string;
      type: string;
      super: string | null;
      description: string;
      energy: number;
      might: number;
      power: number;
      tags: string[];
      colors: {
        id: string;
        name: string;
        hexCode?: string;
        /** Format: uri */
        imageUrl?: string;
      }[];
      variants: {
        id: string;
        variantNumber: string;
        rarity: string;
        variantType: string;
        variantLabel: string;
        foilMode: string;
        /** Format: uri */
        imageUrl: string;
        cardmarketId: number | null;
        tcgplayerId: number | null;
        releaseDate: string | null;
        artist: string | null;
        prices: {
          /** @enum {string} */
          currency: 'EUR';
          low: number | null;
          market: number | null;
          avg7d: number | null;
          isFoil: boolean;
        }[];
      }[];
      banEffectiveDate: string | null;
    };
    CardDetailResponseInput: {
      data: {
        id: string;
        name: string;
        type: string;
        super: string | null;
        description: string;
        energy: number;
        might: number;
        power: number;
        tags: string[];
        colors: {
          id: string;
          name: string;
          hexCode?: string;
          /** Format: uri */
          imageUrl?: string;
        }[];
        variants: {
          id: string;
          variantNumber: string;
          rarity: string;
          variantType: string;
          variantLabel: string;
          foilMode: string;
          /** Format: uri */
          imageUrl: string;
          cardmarketId: number | null;
          tcgplayerId: number | null;
          releaseDate: string | null;
          artist: string | null;
          prices: {
            /** @enum {string} */
            currency: 'EUR';
            low: number | null;
            market: number | null;
            avg7d: number | null;
            isFoil: boolean;
          }[];
        }[];
        banEffectiveDate: string | null;
      };
      meta: {
        /** @enum {string} */
        source: 'cache' | 'upstream' | 'cache-refreshed';
        contentHash: string;
      };
    };
    CardListItemInput: {
      cardId: string;
      variantNumber: string;
      name: string;
      type: string;
      super?: string | null;
      variantType?: string;
      energy: number;
      might: number;
      power: number;
      rarity: string;
      setCode: string;
      colors: string[];
      /** Format: uri */
      imageUrl: string;
      cardmarketId: number | null;
      priceEur: {
        /** @enum {string} */
        currency: 'EUR';
        low: number | null;
        market: number | null;
        avg7d: number | null;
        isFoil: boolean;
      } | null;
      printings: {
        variantNumber: string;
        variantLabel: string;
        isFoil: boolean;
        foilMode?: string;
        priceEur: {
          /** @enum {string} */
          currency: 'EUR';
          low: number | null;
          market: number | null;
          avg7d: number | null;
          isFoil: boolean;
        } | null;
      }[];
      isBanned: boolean;
    };
    CardListPrintingInput: {
      variantNumber: string;
      variantLabel: string;
      isFoil: boolean;
      foilMode?: string;
      priceEur: {
        /** @enum {string} */
        currency: 'EUR';
        low: number | null;
        market: number | null;
        avg7d: number | null;
        isFoil: boolean;
      } | null;
    };
    CardsBatchRequestInput: {
      variantNumbers: string[];
    };
    CardsBatchResponseInput: {
      data: {
        id: string;
        name: string;
        type: string;
        super: string | null;
        description: string;
        energy: number;
        might: number;
        power: number;
        tags: string[];
        colors: {
          id: string;
          name: string;
          hexCode?: string;
          /** Format: uri */
          imageUrl?: string;
        }[];
        variants: {
          id: string;
          variantNumber: string;
          rarity: string;
          variantType: string;
          variantLabel: string;
          foilMode: string;
          /** Format: uri */
          imageUrl: string;
          cardmarketId: number | null;
          tcgplayerId: number | null;
          releaseDate: string | null;
          artist: string | null;
          prices: {
            /** @enum {string} */
            currency: 'EUR';
            low: number | null;
            market: number | null;
            avg7d: number | null;
            isFoil: boolean;
          }[];
        }[];
        banEffectiveDate: string | null;
      }[];
      meta: {
        found: number;
        notFound: string[];
        /** @enum {string} */
        source: 'cache' | 'mixed' | 'upstream';
      };
    };
    CardsDetailQueryInput: {
      refresh?: 'true' | 'false';
    };
    CardsListQueryInput: {
      q?: string;
      sets?: string;
      colors?: string;
      /**
       * @default all
       * @enum {string}
       */
      colorMode: 'all' | 'within';
      types?: string;
      super?: string;
      variants?: string;
      rarities?: string;
      energyMin?: number;
      energyMax?: number;
      powerMin?: number;
      powerMax?: number;
      mightMin?: number;
      mightMax?: number;
      /** @default 1 */
      page: number;
      /** @default 50 */
      limit: number;
      /**
       * @default name
       * @enum {string}
       */
      sortBy: 'name' | 'energy' | 'variantNumber' | 'releaseDate' | 'price';
      /**
       * @default asc
       * @enum {string}
       */
      dir: 'asc' | 'desc';
      refresh?: 'true' | 'false';
      excludeTokens?: 'true' | 'false';
    };
    CardsListResponseInput: {
      data: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super?: string | null;
        variantType?: string;
        energy: number;
        might: number;
        power: number;
        rarity: string;
        setCode: string;
        colors: string[];
        /** Format: uri */
        imageUrl: string;
        cardmarketId: number | null;
        priceEur: {
          /** @enum {string} */
          currency: 'EUR';
          low: number | null;
          market: number | null;
          avg7d: number | null;
          isFoil: boolean;
        } | null;
        printings: {
          variantNumber: string;
          variantLabel: string;
          isFoil: boolean;
          foilMode?: string;
          priceEur: {
            /** @enum {string} */
            currency: 'EUR';
            low: number | null;
            market: number | null;
            avg7d: number | null;
            isFoil: boolean;
          } | null;
        }[];
        isBanned: boolean;
      }[];
      meta: {
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNext: boolean;
          hasPrevious?: boolean;
        };
        /** @enum {string} */
        source: 'cache' | 'mixed' | 'upstream';
        catalogHash: string;
      };
    };
    CatalogIndexResponseInput: {
      data: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super?: string | null;
        variantType?: string;
        energy: number;
        might: number;
        power: number;
        rarity: string;
        setCode: string;
        colors: string[];
        /** Format: uri */
        imageUrl: string;
        cardmarketId: number | null;
        priceEur: {
          /** @enum {string} */
          currency: 'EUR';
          low: number | null;
          market: number | null;
          avg7d: number | null;
          isFoil: boolean;
        } | null;
        printings: {
          variantNumber: string;
          variantLabel: string;
          isFoil: boolean;
          foilMode?: string;
          priceEur: {
            /** @enum {string} */
            currency: 'EUR';
            low: number | null;
            market: number | null;
            avg7d: number | null;
            isFoil: boolean;
          } | null;
        }[];
        isBanned: boolean;
      }[];
      meta: {
        catalogHash: string;
        pricesCatalogHash: string;
        total: number;
        /** @enum {string} */
        source: 'cache';
      };
    };
    /** @enum {string} */
    CatalogLayoutInput: 'grid' | 'list';
    CollectionActivityCursorInput: {
      /** Format: date-time */
      at: string;
      id: string;
    };
    CollectionActivityEventInput: {
      id: string;
      /** Format: date-time */
      at: string;
      /** @enum {string} */
      action:
        | 'add'
        | 'remove'
        | 'upsert'
        | 'delete'
        | 'clear'
        | 'batch'
        | 'import'
        | 'share_merge'
        | 'share_discard'
        | 'share_leave';
      quantityDelta: number;
      quantityAfter: number | null;
      isFoil: boolean | null;
      actor: {
        userId: string;
        name: string | null;
        email: string | null;
      };
    };
    CollectionActivityHistoryRequestInput: {
      variantNumbers: string[];
      /** @default 20 */
      limit: number;
      cursor?: {
        /** Format: date-time */
        at: string;
        id: string;
      };
    };
    CollectionActivityHistoryResponseInput: {
      data: {
        id: string;
        /** Format: date-time */
        at: string;
        /** @enum {string} */
        action:
          | 'add'
          | 'remove'
          | 'upsert'
          | 'delete'
          | 'clear'
          | 'batch'
          | 'import'
          | 'share_merge'
          | 'share_discard'
          | 'share_leave';
        quantityDelta: number;
        quantityAfter: number | null;
        isFoil: boolean | null;
        actor: {
          userId: string;
          name: string | null;
          email: string | null;
        };
      }[];
      meta: {
        hasMore: boolean;
        nextCursor: {
          /** Format: date-time */
          at: string;
          id: string;
        } | null;
      };
    };
    CollectionAdjustRequestInput: {
      /** @default 1 */
      delta: number;
      /**
       * @default near_mint
       * @enum {string}
       */
      condition:
        | 'mint'
        | 'near_mint'
        | 'lightly_played'
        | 'moderately_played'
        | 'heavily_played'
        | 'damaged'
        | 'unspecified';
      /** @default en */
      language: string;
      isFoil?: boolean;
    };
    /** @enum {string} */
    CollectionAuditActionInput:
      | 'add'
      | 'remove'
      | 'upsert'
      | 'delete'
      | 'clear'
      | 'batch'
      | 'import'
      | 'share_merge'
      | 'share_discard'
      | 'share_leave';
    CollectionAuditActorInput: {
      userId: string;
      name: string | null;
      email: string | null;
    };
    CollectionAuditEventInput: {
      id: string;
      collectionId: string | null;
      /** @enum {string} */
      action:
        | 'add'
        | 'remove'
        | 'upsert'
        | 'delete'
        | 'clear'
        | 'batch'
        | 'import'
        | 'share_merge'
        | 'share_discard'
        | 'share_leave';
      variantNumber: string | null;
      condition:
        | (
            | 'mint'
            | 'near_mint'
            | 'lightly_played'
            | 'moderately_played'
            | 'heavily_played'
            | 'damaged'
            | 'unspecified'
          )
        | null;
      language: string | null;
      isFoil: boolean | null;
      quantityBefore: number | null;
      quantityAfter: number | null;
      quantityDelta: number | null;
      metadata: {
        [key: string]: unknown;
      } | null;
      /** Format: date-time */
      createdAt: string;
      actor: {
        userId: string;
        name: string | null;
        email: string | null;
      };
    };
    CollectionAuditListQueryInput: {
      /** @default 50 */
      limit: number;
      /** Format: date-time */
      before?: string;
      variantNumber?: string;
      actorUserId?: string;
      mine?: boolean | ('true' | 'false' | '1' | '0');
      /** @enum {string} */
      action?:
        | 'add'
        | 'remove'
        | 'upsert'
        | 'delete'
        | 'clear'
        | 'batch'
        | 'import'
        | 'share_merge'
        | 'share_discard'
        | 'share_leave';
    };
    CollectionAuditListResponseInput: {
      data: {
        id: string;
        collectionId: string | null;
        /** @enum {string} */
        action:
          | 'add'
          | 'remove'
          | 'upsert'
          | 'delete'
          | 'clear'
          | 'batch'
          | 'import'
          | 'share_merge'
          | 'share_discard'
          | 'share_leave';
        variantNumber: string | null;
        condition:
          | (
              | 'mint'
              | 'near_mint'
              | 'lightly_played'
              | 'moderately_played'
              | 'heavily_played'
              | 'damaged'
              | 'unspecified'
            )
          | null;
        language: string | null;
        isFoil: boolean | null;
        quantityBefore: number | null;
        quantityAfter: number | null;
        quantityDelta: number | null;
        metadata: {
          [key: string]: unknown;
        } | null;
        /** Format: date-time */
        createdAt: string;
        actor: {
          userId: string;
          name: string | null;
          email: string | null;
        };
      }[];
      meta: {
        total: number;
        limit: number;
        hasMore: boolean;
      };
    };
    CollectionBatchSyncRequestInput: {
      items: {
        variantNumber: string;
        /** @default 1 */
        quantity: number;
        /**
         * @default near_mint
         * @enum {string}
         */
        condition:
          | 'mint'
          | 'near_mint'
          | 'lightly_played'
          | 'moderately_played'
          | 'heavily_played'
          | 'damaged'
          | 'unspecified';
        /** @default en */
        language: string;
        isFoil?: boolean;
        notes?: string | null;
        isGraded?: boolean;
        gradeCompany?: string | null;
        gradeScore?: string | null;
        acquiredAt?: string | null;
        acquiredPriceCents?: number | null;
      }[];
    };
    CollectionBatchSyncResponseInput: {
      data: {
        synced: number;
      };
    };
    CollectionDeleteQueryInput: {
      /**
       * @default near_mint
       * @enum {string}
       */
      condition:
        | 'mint'
        | 'near_mint'
        | 'lightly_played'
        | 'moderately_played'
        | 'heavily_played'
        | 'damaged'
        | 'unspecified';
      /** @default en */
      language: string;
      isFoil?: 'true' | 'false';
    };
    /** @enum {string} */
    CollectionImportModeInput: 'set' | 'add';
    CollectionImportPreviewChangeInput: {
      variantNumber: string;
      name: string | null;
      setCode: string | null;
      imageUrl: string | null;
      quantityBefore: number;
      quantityAfter: number;
      quantityDelta: number;
      /** @enum {string} */
      status: 'new' | 'increase' | 'decrease' | 'unchanged';
    };
    CollectionImportPreviewItemInput: {
      variantNumber: string;
      quantity: number;
      /**
       * @default near_mint
       * @enum {string}
       */
      condition:
        | 'mint'
        | 'near_mint'
        | 'lightly_played'
        | 'moderately_played'
        | 'heavily_played'
        | 'damaged'
        | 'unspecified';
      /** @default en */
      language: string;
      isFoil?: boolean;
    };
    CollectionImportPreviewRequestInput:
      | {
          tts: string;
        }
      | {
          items: {
            variantNumber: string;
            quantity: number;
            /**
             * @default near_mint
             * @enum {string}
             */
            condition:
              | 'mint'
              | 'near_mint'
              | 'lightly_played'
              | 'moderately_played'
              | 'heavily_played'
              | 'damaged'
              | 'unspecified';
            /** @default en */
            language: string;
            isFoil?: boolean;
          }[];
        };
    CollectionImportPreviewResponseInput: {
      data: {
        totalTokens: number;
        totalCopies: number;
        uniquePrintings: number;
        unresolvedCount: number;
        newCount: number;
        increasedCount: number;
        decreasedCount: number;
        unchangedCount: number;
        changes: {
          variantNumber: string;
          name: string | null;
          setCode: string | null;
          imageUrl: string | null;
          quantityBefore: number;
          quantityAfter: number;
          quantityDelta: number;
          /** @enum {string} */
          status: 'new' | 'increase' | 'decrease' | 'unchanged';
        }[];
        unresolved: {
          token: string;
          message: string;
        }[];
        items: {
          variantNumber: string;
          quantity: number;
          /**
           * @default near_mint
           * @enum {string}
           */
          condition:
            | 'mint'
            | 'near_mint'
            | 'lightly_played'
            | 'moderately_played'
            | 'heavily_played'
            | 'damaged'
            | 'unspecified';
          /** @default en */
          language: string;
          isFoil?: boolean;
        }[];
      };
    };
    /** @enum {string} */
    CollectionImportPreviewStatusInput: 'new' | 'increase' | 'decrease' | 'unchanged';
    CollectionImportRequestInput: {
      csv?: string;
      tts?: string;
      /**
       * @default set
       * @enum {string}
       */
      mode: 'set' | 'add';
      items?: {
        variantNumber: string;
        quantity: number;
        /**
         * @default near_mint
         * @enum {string}
         */
        condition:
          | 'mint'
          | 'near_mint'
          | 'lightly_played'
          | 'moderately_played'
          | 'heavily_played'
          | 'damaged'
          | 'unspecified';
        /** @default en */
        language: string;
        isFoil?: boolean;
        notes?: string | null;
        isGraded?: boolean;
        gradeCompany?: string | null;
        gradeScore?: string | null;
      }[];
    };
    CollectionImportResponseInput: {
      data: {
        imported: number;
        totalCopies: number;
        rowsProcessed?: number;
        resolvedFromUpstream?: number;
        failedRows: number;
        errors: {
          row: number;
          message: string;
        }[];
      };
    };
    CollectionItemInput: {
      id: string;
      variantNumber: string;
      quantity: number;
      /** @enum {string} */
      condition:
        | 'mint'
        | 'near_mint'
        | 'lightly_played'
        | 'moderately_played'
        | 'heavily_played'
        | 'damaged'
        | 'unspecified';
      language: string;
      isFoil: boolean;
      notes: string | null;
      isGraded: boolean;
      gradeCompany: string | null;
      gradeScore: string | null;
      acquiredAt: string | null;
      acquiredPriceCents: number | null;
      /** Format: date-time */
      addedAt: string;
      /** Format: date-time */
      updatedAt: string;
      name: string;
      imageUrl: string;
      setCode: string;
      rarity: string;
      type: string | null;
      variantLabel: string;
    };
    CollectionItemResponseInput: {
      data: {
        id: string;
        variantNumber: string;
        quantity: number;
        /** @enum {string} */
        condition:
          | 'mint'
          | 'near_mint'
          | 'lightly_played'
          | 'moderately_played'
          | 'heavily_played'
          | 'damaged'
          | 'unspecified';
        language: string;
        isFoil: boolean;
        notes: string | null;
        isGraded: boolean;
        gradeCompany: string | null;
        gradeScore: string | null;
        acquiredAt: string | null;
        acquiredPriceCents: number | null;
        /** Format: date-time */
        addedAt: string;
        /** Format: date-time */
        updatedAt: string;
        name: string;
        imageUrl: string;
        setCode: string;
        rarity: string;
        type: string | null;
        variantLabel: string;
      };
    };
    CollectionListResponseInput: {
      data: {
        id: string;
        variantNumber: string;
        quantity: number;
        /** @enum {string} */
        condition:
          | 'mint'
          | 'near_mint'
          | 'lightly_played'
          | 'moderately_played'
          | 'heavily_played'
          | 'damaged'
          | 'unspecified';
        language: string;
        isFoil: boolean;
        notes: string | null;
        isGraded: boolean;
        gradeCompany: string | null;
        gradeScore: string | null;
        acquiredAt: string | null;
        acquiredPriceCents: number | null;
        /** Format: date-time */
        addedAt: string;
        /** Format: date-time */
        updatedAt: string;
        name: string;
        imageUrl: string;
        setCode: string;
        rarity: string;
        type: string | null;
        variantLabel: string;
      }[];
      meta: {
        total: number;
        totalQuantity: number;
      };
    };
    /** @enum {string} */
    CollectionLiveChangeReasonInput:
      'upsert' | 'add' | 'remove' | 'delete' | 'clear' | 'batch' | 'import';
    CollectionLiveChangedEventInput: {
      /** @enum {string} */
      type: 'collection.changed';
      collectionId: string;
      /** @enum {string} */
      reason: 'upsert' | 'add' | 'remove' | 'delete' | 'clear' | 'batch' | 'import';
      actorUserId: string;
      /** Format: date-time */
      at: string;
    };
    CollectionLiveEventInput:
      | {
          /** @enum {string} */
          type: 'collection.changed';
          collectionId: string;
          /** @enum {string} */
          reason: 'upsert' | 'add' | 'remove' | 'delete' | 'clear' | 'batch' | 'import';
          actorUserId: string;
          /** Format: date-time */
          at: string;
        }
      | {
          /** @enum {string} */
          type: 'ready';
          collectionId: string;
        }
      | {
          /** @enum {string} */
          type: 'heartbeat';
          /** Format: date-time */
          at: string;
        };
    CollectionLiveHeartbeatEventInput: {
      /** @enum {string} */
      type: 'heartbeat';
      /** Format: date-time */
      at: string;
    };
    CollectionLiveReadyEventInput: {
      /** @enum {string} */
      type: 'ready';
      collectionId: string;
    };
    CollectionQuantitiesRequestInput: {
      variantNumbers: string[];
    };
    CollectionQuantitiesResponseInput: {
      data: {
        variantNumber: string;
        isFoil: boolean;
        quantity: number;
      }[];
    };
    CollectionQuantityRowInput: {
      variantNumber: string;
      isFoil: boolean;
      quantity: number;
    };
    CollectionRecentAddsRequest: {
      variantNumbers: string[];
    };
    CollectionRecentAddsRequestInput: {
      variantNumbers: string[];
    };
    CollectionRecentAddsResponseInput: {
      data: {
        id: string;
        /** Format: date-time */
        at: string;
        /** @enum {string} */
        action:
          | 'add'
          | 'remove'
          | 'upsert'
          | 'delete'
          | 'clear'
          | 'batch'
          | 'import'
          | 'share_merge'
          | 'share_discard'
          | 'share_leave';
        quantityDelta: number;
        quantityAfter: number | null;
        isFoil: boolean | null;
        actor: {
          userId: string;
          name: string | null;
          email: string | null;
        };
      }[];
    };
    /** @enum {string} */
    CollectionShareAcceptModeInput: 'use_theirs' | 'merge';
    CollectionShareAcceptRequestInput: {
      /** @enum {string} */
      mode: 'use_theirs' | 'merge';
    };
    CollectionShareAcceptResponseInput: {
      data: {
        shared: boolean;
        memberCount: number;
        collectionId: string;
        /** @enum {string} */
        role: 'owner' | 'member';
        partner: {
          userId: string;
          name: string;
          /** Format: email */
          email: string;
        } | null;
        pendingInvite: {
          /** Format: date-time */
          expiresAt: string;
          token?: string;
          url?: string;
        } | null;
      };
    };
    CollectionShareInviteCreateInput: {
      token: string;
      url: string;
      /** Format: date-time */
      expiresAt: string;
    };
    CollectionShareInviteCreateResponseInput: {
      data: {
        token: string;
        url: string;
        /** Format: date-time */
        expiresAt: string;
      };
    };
    CollectionShareInvitePreviewInput: {
      token: string;
      /** Format: date-time */
      expiresAt: string;
      inviter: {
        userId: string;
        name: string;
      };
      theirItemCount: number;
      theirTotalQuantity: number;
      yourItemCount: number;
      yourTotalQuantity: number;
      canAccept: boolean;
      reason: string | null;
    };
    CollectionShareInvitePreviewResponseInput: {
      data: {
        token: string;
        /** Format: date-time */
        expiresAt: string;
        inviter: {
          userId: string;
          name: string;
        };
        theirItemCount: number;
        theirTotalQuantity: number;
        yourItemCount: number;
        yourTotalQuantity: number;
        canAccept: boolean;
        reason: string | null;
      };
    };
    CollectionShareLeaveResponseInput: {
      data: {
        shared: boolean;
        memberCount: number;
        collectionId: string;
        /** @enum {string} */
        role: 'owner' | 'member';
        partner: {
          userId: string;
          name: string;
          /** Format: email */
          email: string;
        } | null;
        pendingInvite: {
          /** Format: date-time */
          expiresAt: string;
          token?: string;
          url?: string;
        } | null;
      };
    };
    CollectionSharePartnerInput: {
      userId: string;
      name: string;
      /** Format: email */
      email: string;
    };
    CollectionSharePendingInviteInput: {
      /** Format: date-time */
      expiresAt: string;
      token?: string;
      url?: string;
    };
    CollectionSharePersonInput: {
      userId: string;
      name: string;
    };
    CollectionShareStatusInput: {
      shared: boolean;
      memberCount: number;
      collectionId: string;
      /** @enum {string} */
      role: 'owner' | 'member';
      partner: {
        userId: string;
        name: string;
        /** Format: email */
        email: string;
      } | null;
      pendingInvite: {
        /** Format: date-time */
        expiresAt: string;
        token?: string;
        url?: string;
      } | null;
    };
    CollectionShareStatusResponseInput: {
      data: {
        shared: boolean;
        memberCount: number;
        collectionId: string;
        /** @enum {string} */
        role: 'owner' | 'member';
        partner: {
          userId: string;
          name: string;
          /** Format: email */
          email: string;
        } | null;
        pendingInvite: {
          /** Format: date-time */
          expiresAt: string;
          token?: string;
          url?: string;
        } | null;
      };
    };
    CollectionUpsertRequestInput: {
      variantNumber: string;
      /** @default 1 */
      quantity: number;
      /**
       * @default near_mint
       * @enum {string}
       */
      condition:
        | 'mint'
        | 'near_mint'
        | 'lightly_played'
        | 'moderately_played'
        | 'heavily_played'
        | 'damaged'
        | 'unspecified';
      /** @default en */
      language: string;
      isFoil?: boolean;
      notes?: string | null;
      isGraded?: boolean;
      gradeCompany?: string | null;
      gradeScore?: string | null;
      acquiredAt?: string | null;
      acquiredPriceCents?: number | null;
    };
    CollectionVariantNumbersRequest: {
      variantNumbers: string[];
    };
    CollectionVariantNumbersRequestInput: {
      variantNumbers: string[];
    };
    ColorRefInput: {
      id: string;
      name: string;
      hexCode?: string;
      /** Format: uri */
      imageUrl?: string;
    };
    CreateDeckVersionRequestInput: {
      name: string;
    };
    DeckCardInputInput: {
      cardId: string;
      variantNumber: string;
      name: string;
      type: string;
      super: string | null;
      tags: string[];
      colors: string[];
      energy: number;
      power?: number;
      setCode: string;
      rarity: string;
      variantType: string;
      isSignature: boolean;
      imageUrl?: string | null;
      banEffectiveDate?: string | null;
    };
    DeckDetailResponseInput: {
      data: {
        id: string;
        name: string;
        description?: string;
        /**
         * @default constructed
         * @enum {string}
         */
        format: 'constructed' | 'pre-rift';
        createdAt: number;
        updatedAt: number;
        legend: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        } | null;
        champion: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        } | null;
        mainDeck: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        runes: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        battlefields: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        sideboard: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        upstreamId?: string;
        importedFromId?: string;
        syncWarnings?: string[];
        /** @enum {string} */
        source: 'owned' | 'imported';
        readOnly: boolean;
        authorName?: string;
        views?: number;
        likes?: number;
        isLegal?: boolean;
        setPrefixes?: string[];
        hasGuide?: boolean;
        hasVideo?: boolean;
        hasMatchups?: boolean;
        videoUrl?: string;
        bannedCardNames?: string[];
        versionId?: string;
        versionName?: string;
        versions?: {
          id: string;
          name: string;
          createdAt: number;
          updatedAt: number;
          isActive: boolean;
        }[];
      };
    };
    DeckEntryInputInput: {
      card: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      };
      count: number;
    };
    /** @enum {string} */
    DeckFormatInput: 'constructed' | 'pre-rift';
    DeckListItemInput: {
      id: string;
      name: string;
      description?: string;
      /**
       * @default constructed
       * @enum {string}
       */
      format: 'constructed' | 'pre-rift';
      createdAt: number;
      updatedAt: number;
      legend: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      champion: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      mainDeck: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      runes: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      battlefields: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      sideboard: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      upstreamId?: string;
      importedFromId?: string;
      syncWarnings?: string[];
      /** @enum {string} */
      source: 'owned' | 'imported';
      readOnly: boolean;
      authorName?: string;
      views?: number;
      likes?: number;
      isLegal?: boolean;
      setPrefixes?: string[];
      hasGuide?: boolean;
      hasVideo?: boolean;
      hasMatchups?: boolean;
      videoUrl?: string;
      bannedCardNames?: string[];
      versionId?: string;
      versionName?: string;
      versions?: {
        id: string;
        name: string;
        createdAt: number;
        updatedAt: number;
        isActive: boolean;
      }[];
    };
    DeckListResponseInput: {
      data: {
        id: string;
        name: string;
        description?: string;
        /**
         * @default constructed
         * @enum {string}
         */
        format: 'constructed' | 'pre-rift';
        createdAt: number;
        updatedAt: number;
        legend: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        } | null;
        champion: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        } | null;
        mainDeck: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        runes: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        battlefields: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        sideboard: {
          card: {
            cardId: string;
            variantNumber: string;
            name: string;
            type: string;
            super: string | null;
            tags: string[];
            colors: string[];
            energy: number;
            power?: number;
            setCode: string;
            rarity: string;
            variantType: string;
            isSignature: boolean;
            imageUrl?: string | null;
            banEffectiveDate?: string | null;
          };
          count: number;
        }[];
        upstreamId?: string;
        importedFromId?: string;
        syncWarnings?: string[];
        /** @enum {string} */
        source: 'owned' | 'imported';
        readOnly: boolean;
        authorName?: string;
        views?: number;
        likes?: number;
        isLegal?: boolean;
        setPrefixes?: string[];
        hasGuide?: boolean;
        hasVideo?: boolean;
        hasMatchups?: boolean;
        videoUrl?: string;
        bannedCardNames?: string[];
        versionId?: string;
        versionName?: string;
        versions?: {
          id: string;
          name: string;
          createdAt: number;
          updatedAt: number;
          isActive: boolean;
        }[];
      }[];
      meta: {
        total: number;
        owned: number;
        imported: number;
        pagination?: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNext: boolean;
          hasPrevious?: boolean;
        };
      };
    };
    DeckRulesResponseInput: {
      data: {
        version: string;
        rules: {
          version: string;
          game: string;
          format: string;
          sections: {
            [key: string]: {
              key: string;
              title: string;
              target: number;
              single?: boolean;
              minimum?: number;
              exact?: boolean;
              maximum?: number;
              required: boolean;
              uniqueNames?: boolean;
              description: string;
            };
          };
          copyLimits: {
            default: number | null;
            rune: number;
            battlefieldPerName: number;
            signatureTotal: number | null;
          };
          maxDomains?: number | null;
          requireChampionTagMatch?: boolean;
          requireSignatureTagMatch?: boolean;
          restrictPicker?: boolean;
          constraints: {
            code: string;
            message: string;
          }[];
        };
      };
    };
    /** @enum {string} */
    DeckSortFieldInput: 'trending' | 'likes' | 'views' | 'createdAt' | 'editedAt';
    /** @enum {string} */
    DeckSourceInput: 'owned' | 'imported';
    DeckUpsertRequestInput: {
      id: string;
      name: string;
      description?: string;
      /**
       * @default constructed
       * @enum {string}
       */
      format: 'constructed' | 'pre-rift';
      createdAt: number;
      updatedAt: number;
      legend: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      champion: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      mainDeck: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      runes: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      battlefields: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      sideboard: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      upstreamId?: string;
      importedFromId?: string;
      syncWarnings?: string[];
    };
    DeckValidateInputInput: {
      /**
       * @default constructed
       * @enum {string}
       */
      format: 'constructed' | 'pre-rift';
      legend: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      champion: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      mainDeck: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      runes: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      battlefields: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      sideboard: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
    };
    DeckValidateResponseInput: {
      data: {
        messages: {
          /** @enum {string} */
          type: 'error' | 'warning' | 'valid';
          code: string;
          message: string;
        }[];
        valid: boolean;
        hasErrors: boolean;
      };
    };
    DeckValidationMessageInput: {
      /** @enum {string} */
      type: 'error' | 'warning' | 'valid';
      code: string;
      message: string;
    };
    DeckVersionName: string;
    DeckVersionNameInput: string;
    DeckVersionSummaryInput: {
      id: string;
      name: string;
      createdAt: number;
      updatedAt: number;
      isActive: boolean;
    };
    DecksListQueryInput: {
      q?: string;
      legend?: string;
      sets?: string;
      isLegal?: 'true' | 'false';
      hasGuide?: 'true' | 'false';
      hasVideo?: 'true' | 'false';
      hasMatchups?: 'true' | 'false';
      /** @default 1 */
      page: number;
      /** @default 25 */
      limit: number;
      /**
       * @default trending
       * @enum {string}
       */
      sort: 'trending' | 'likes' | 'views' | 'createdAt' | 'editedAt';
      /**
       * @default desc
       * @enum {string}
       */
      dir: 'asc' | 'desc';
      /**
       * @default all
       * @enum {string}
       */
      source: 'owned' | 'imported' | 'all';
      preview?: 'true' | 'false';
    };
    FilterSnapshotInput: {
      colors: {
        id: string;
        name: string;
        count: number;
        imageUrl?: string;
      }[];
      sets: {
        id: string;
        name: string;
        count: number;
        code?: string;
        printCount?: number;
        foilPrintCount?: number;
      }[];
      types: {
        id: string;
        name: string;
        count: number;
      }[];
      supertypes: {
        id: string;
        name: string;
        count: number;
      }[];
      rarities: {
        id: string;
        name: string;
        count: number;
      }[];
      variants: {
        id: string;
        name: string;
        count: number;
      }[];
    };
    FiltersResponseInput: {
      data: {
        colors: {
          id: string;
          name: string;
          count: number;
          imageUrl?: string;
        }[];
        sets: {
          id: string;
          name: string;
          count: number;
          code?: string;
          printCount?: number;
          foilPrintCount?: number;
        }[];
        types: {
          id: string;
          name: string;
          count: number;
        }[];
        supertypes: {
          id: string;
          name: string;
          count: number;
        }[];
        rarities: {
          id: string;
          name: string;
          count: number;
        }[];
        variants: {
          id: string;
          name: string;
          count: number;
        }[];
      };
      meta: {
        /** Format: date-time */
        cachedAt: string;
        catalogHash: string;
        pricesCatalogHash: string;
        variantCount: number;
      };
    };
    GlobalSearchQueryInput: {
      q: string;
      types?: string;
      /** @default 10 */
      limit: number;
      /** @default 1 */
      page: number;
    };
    GlobalSearchResponseInput: {
      data: {
        cards?: {
          hits: {
            /** @enum {string} */
            kind: 'card';
            variantNumber: string;
            name: string;
            /** Format: uri */
            imageUrl: string;
            setCode: string;
            type: string;
            rarity: string;
            textMatch?: number;
          }[];
          total: number;
        };
        decks?: {
          hits: {
            /** @enum {string} */
            kind: 'deck';
            id: string;
            name: string;
            textMatch?: number;
          }[];
          total: number;
        };
      };
      meta: {
        tookMs: number;
        catalogHash: string;
      };
    };
    /** @enum {string} */
    GridCardSizeInput: 'large' | 'medium' | 'small';
    HealthResponseInput: {
      data: {
        /** @enum {string} */
        status: 'ok';
        /** @enum {string} */
        db: 'ok' | 'error';
        lastCatalogSync: string | null;
        emailVerificationRequired: boolean;
      };
    };
    IdDataInput: {
      id: string;
    };
    IdResponseInput: {
      data: {
        id: string;
      };
    };
    ImageThumbQueryInput: {
      w?: number;
    };
    IsoDateString: string;
    IsoDateStringInput: string;
    /** Format: date-time */
    IsoDateTimeString: string;
    /** Format: date-time */
    IsoDateTimeStringInput: string;
    OkDataInput: {
      /** @enum {boolean} */
      ok: true;
    };
    OkResponseInput: {
      data: {
        /** @enum {boolean} */
        ok: true;
      };
    };
    PaCardsBatchResponseInput: {
      data: {
        id: string;
        variantNumber: string;
        imageUrl: string;
        rarity: string;
        variantType: string;
        foilMode: string;
        variantTypes: string[];
        showInLibrary: boolean;
        isCollectible: boolean;
        variantLabel?: string;
        flavorText?: string | null;
        artist?: string | null;
        releaseDate?: string | null;
        cardmarketId?: number | null;
        tcgplayerId?: number | null;
        parentVariantId?: string | null;
        set: {
          id: string;
          name: string;
          prefix: string;
          releaseDate?: string;
        };
        card?: unknown;
      }[];
      notFound: string[];
    };
    PaCardsListResponseInput: {
      data: {
        id: string;
        variantNumber: string;
        imageUrl: string;
        rarity: string;
        variantType: string;
        foilMode: string;
        variantTypes: string[];
        showInLibrary: boolean;
        isCollectible: boolean;
        variantLabel?: string;
        flavorText?: string | null;
        artist?: string | null;
        releaseDate?: string | null;
        cardmarketId?: number | null;
        tcgplayerId?: number | null;
        parentVariantId?: string | null;
        set: {
          id: string;
          name: string;
          prefix: string;
          releaseDate?: string;
        };
        card?: unknown;
      }[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious?: boolean;
      };
      meta?: {
        filters: {
          [key: string]: unknown;
        };
      };
    };
    PaColorInput: {
      id: string;
      name: string;
      hexCode?: string;
      /** Format: uri */
      imageUrl?: string;
    };
    PaLogicalCardInput: {
      id: string;
      name: string;
      type: string;
      super?: string | null;
      description?: string;
      energy: number;
      might: number;
      power: number;
      tags?: string[];
      attachText?: string | null;
      effect?: string | null;
      mightBonus?: number;
      maxCopies?: number | null;
      banEffectiveDate?: string | null;
      colors: {
        id: string;
        name: string;
        hexCode?: string;
        /** Format: uri */
        imageUrl?: string;
      }[];
      variants: {
        id: string;
        variantNumber: string;
        imageUrl: string;
        rarity: string;
        variantType: string;
        foilMode: string;
        variantTypes: string[];
        showInLibrary: boolean;
        isCollectible: boolean;
        variantLabel?: string;
        flavorText?: string | null;
        artist?: string | null;
        releaseDate?: string | null;
        cardmarketId?: number | null;
        tcgplayerId?: number | null;
        parentVariantId?: string | null;
        set: {
          id: string;
          name: string;
          prefix: string;
          releaseDate?: string;
        };
      }[];
    };
    PaPriceRowInput: {
      id: string;
      cardmarketId: number;
      tcgPlayerId?: number | null;
      provider: string;
      isFoil: boolean;
      currency: string;
      lowPrice: string | null;
      marketPrice: string | null;
      midPrice: string | null;
      highPrice: string | null;
      directLowPrice?: string | null;
      avg1Day: string | null;
      avg7Day: string | null;
      avg30Day: string | null;
      lastUpdated: string;
    };
    PaPricesListResponseInput: {
      data: {
        id: string;
        cardmarketId: number;
        tcgPlayerId?: number | null;
        provider: string;
        isFoil: boolean;
        currency: string;
        lowPrice: string | null;
        marketPrice: string | null;
        midPrice: string | null;
        highPrice: string | null;
        directLowPrice?: string | null;
        avg1Day: string | null;
        avg7Day: string | null;
        avg30Day: string | null;
        lastUpdated: string;
      }[];
    };
    PaSetInput: {
      id: string;
      name: string;
      prefix: string;
      releaseDate?: string;
    };
    PaVariantInput: {
      id: string;
      variantNumber: string;
      imageUrl: string;
      rarity: string;
      variantType: string;
      foilMode: string;
      variantTypes: string[];
      showInLibrary: boolean;
      isCollectible: boolean;
      variantLabel?: string;
      flavorText?: string | null;
      artist?: string | null;
      releaseDate?: string | null;
      cardmarketId?: number | null;
      tcgplayerId?: number | null;
      parentVariantId?: string | null;
      set: {
        id: string;
        name: string;
        prefix: string;
        releaseDate?: string;
      };
    };
    PaVariantListItemInput: {
      id: string;
      variantNumber: string;
      imageUrl: string;
      rarity: string;
      variantType: string;
      foilMode: string;
      variantTypes: string[];
      showInLibrary: boolean;
      isCollectible: boolean;
      variantLabel?: string;
      flavorText?: string | null;
      artist?: string | null;
      releaseDate?: string | null;
      cardmarketId?: number | null;
      tcgplayerId?: number | null;
      parentVariantId?: string | null;
      set: {
        id: string;
        name: string;
        prefix: string;
        releaseDate?: string;
      };
      card?: unknown;
    };
    PaginationInput: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious?: boolean;
    };
    PriceDailyPointInput: {
      cardmarketId: number;
      isFoil: boolean;
      /** @enum {string} */
      provider: 'cardmarket';
      /** @enum {string} */
      currency: 'EUR';
      priceDate: string;
      lowPrice: number | null;
      marketPrice: number | null;
      midPrice: number | null;
      highPrice: number | null;
    };
    PriceHistoryQueryInput: {
      cardmarketId?: number;
      variantNumber?: string;
      isFoil?: 'true' | 'false';
      /** @default 30 */
      days: number;
    };
    PriceHistoryResponseInput: {
      data: {
        cardmarketId: number;
        isFoil: boolean;
        /** @enum {string} */
        provider: 'cardmarket';
        /** @enum {string} */
        currency: 'EUR';
        priceDate: string;
        lowPrice: number | null;
        marketPrice: number | null;
        midPrice: number | null;
        highPrice: number | null;
      }[];
      meta: {
        cardmarketId: number | null;
        isFoil: boolean | null;
        days: number;
        rowCount: number;
      };
    };
    PriceRowInput: {
      id: string;
      cardmarketId: number;
      isFoil: boolean;
      /** @enum {string} */
      provider: 'cardmarket';
      /** @enum {string} */
      currency: 'EUR';
      lowPrice: number | null;
      marketPrice: number | null;
      midPrice: number | null;
      highPrice: number | null;
      avg1Day: number | null;
      avg7Day: number | null;
      avg30Day: number | null;
      /** Format: date-time */
      lastUpdated: string;
    };
    PriceStatsInput: {
      variantNumber: string;
      cardmarketId: number | null;
      isFoil: boolean;
      /** @enum {string} */
      currency: 'EUR';
      currentPrice: number | null;
      baselinePrice: number | null;
      minPrice: number | null;
      maxPrice: number | null;
      avgPrice: number | null;
      listingLow: number | null;
      changePercent: number | null;
      /** @enum {string} */
      trend: 'up' | 'down' | 'flat';
      points: {
        cardmarketId: number;
        isFoil: boolean;
        /** @enum {string} */
        provider: 'cardmarket';
        /** @enum {string} */
        currency: 'EUR';
        priceDate: string;
        lowPrice: number | null;
        marketPrice: number | null;
        midPrice: number | null;
        highPrice: number | null;
      }[];
      days: number;
      priceFilterLabel: string;
      priceSourceNote: string;
      targetPriceCents?: number | null;
      belowTarget?: boolean;
    };
    PriceStatsBatchRequestInput: {
      items: {
        variantNumber: string;
        isFoil?: boolean;
        targetPriceCents?: number | null;
      }[];
      /** @default 30 */
      days: number;
    };
    PriceStatsBatchResponseInput: {
      data: {
        variantNumber: string;
        cardmarketId: number | null;
        isFoil: boolean;
        /** @enum {string} */
        currency: 'EUR';
        currentPrice: number | null;
        baselinePrice: number | null;
        minPrice: number | null;
        maxPrice: number | null;
        avgPrice: number | null;
        listingLow: number | null;
        changePercent: number | null;
        /** @enum {string} */
        trend: 'up' | 'down' | 'flat';
        points: {
          cardmarketId: number;
          isFoil: boolean;
          /** @enum {string} */
          provider: 'cardmarket';
          /** @enum {string} */
          currency: 'EUR';
          priceDate: string;
          lowPrice: number | null;
          marketPrice: number | null;
          midPrice: number | null;
          highPrice: number | null;
        }[];
        days: number;
        priceFilterLabel: string;
        priceSourceNote: string;
        targetPriceCents?: number | null;
        belowTarget?: boolean;
      }[];
      meta: {
        days: number;
        rowCount: number;
      };
    };
    PriceSummaryInput: {
      /** @enum {string} */
      currency: 'EUR';
      low: number | null;
      market: number | null;
      avg7d: number | null;
      isFoil: boolean;
    };
    /** @enum {string} */
    PriceTrendInput: 'up' | 'down' | 'flat';
    PricesListQueryInput: {
      cardmarketId?: number;
      variantNumber?: string;
      isFoil?: 'true' | 'false';
    };
    PricesListResponseInput: {
      data: {
        id: string;
        cardmarketId: number;
        isFoil: boolean;
        /** @enum {string} */
        provider: 'cardmarket';
        /** @enum {string} */
        currency: 'EUR';
        lowPrice: number | null;
        marketPrice: number | null;
        midPrice: number | null;
        highPrice: number | null;
        avg1Day: number | null;
        avg7Day: number | null;
        avg30Day: number | null;
        /** Format: date-time */
        lastUpdated: string;
      }[];
      meta: {
        pricesCatalogHash: string;
        lastSyncedAt: string | null;
        rowCount: number;
      };
    };
    QueryBooleanString: boolean;
    QueryBooleanStringInput: 'true' | 'false';
    RenameDeckVersionRequestInput: {
      name: string;
    };
    /** @enum {string} */
    SearchEntityTypeInput: 'cards' | 'decks' | 'navigation' | 'actions';
    SearchHitCardInput: {
      /** @enum {string} */
      kind: 'card';
      variantNumber: string;
      name: string;
      /** Format: uri */
      imageUrl: string;
      setCode: string;
      type: string;
      rarity: string;
      textMatch?: number;
    };
    SearchHitDeckInput: {
      /** @enum {string} */
      kind: 'deck';
      id: string;
      name: string;
      textMatch?: number;
    };
    /** @enum {string} */
    SettingsDeviceProfileInput: 'phone' | 'desktop';
    StoredDeckPayload: {
      id: string;
      name: string;
      description?: string;
      /**
       * @default constructed
       * @enum {string}
       */
      format: 'constructed' | 'pre-rift';
      createdAt: number;
      updatedAt: number;
      legend: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      champion: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      mainDeck: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      runes: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      battlefields: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      sideboard: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      upstreamId?: string;
      importedFromId?: string;
      syncWarnings?: string[];
    };
    StoredDeckPayloadInput: {
      id: string;
      name: string;
      description?: string;
      /**
       * @default constructed
       * @enum {string}
       */
      format: 'constructed' | 'pre-rift';
      createdAt: number;
      updatedAt: number;
      legend: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      champion: {
        cardId: string;
        variantNumber: string;
        name: string;
        type: string;
        super: string | null;
        tags: string[];
        colors: string[];
        energy: number;
        power?: number;
        setCode: string;
        rarity: string;
        variantType: string;
        isSignature: boolean;
        imageUrl?: string | null;
        banEffectiveDate?: string | null;
      } | null;
      mainDeck: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      runes: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      battlefields: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      sideboard: {
        card: {
          cardId: string;
          variantNumber: string;
          name: string;
          type: string;
          super: string | null;
          tags: string[];
          colors: string[];
          energy: number;
          power?: number;
          setCode: string;
          rarity: string;
          variantType: string;
          isSignature: boolean;
          imageUrl?: string | null;
          banEffectiveDate?: string | null;
        };
        count: number;
      }[];
      upstreamId?: string;
      importedFromId?: string;
      syncWarnings?: string[];
    };
    SyncCatalogResponseInput: {
      data: {
        changed: boolean;
        pages: number;
        variantCount: number;
        hash: string;
      };
    };
    SyncPricesResponseInput: {
      data: {
        changed: boolean;
        rowCount: number;
        productCount: number;
        hash: string;
        /** @enum {string} */
        source: 'cardmarket';
        gameId: number;
        exportCreatedAt: string;
        cardmarketIdsBackfilled: number;
      };
    };
    SyncStatusResponseInput: {
      data: {
        catalog: {
          lastRun: string | null;
          /** @enum {string} */
          status: 'idle' | 'running' | 'failed';
          hash: string;
          variantCount: number;
        };
        prices: {
          lastRun: string | null;
          /** @enum {string} */
          status: 'idle' | 'running' | 'failed';
          hash: string;
          rowCount: number;
        };
      };
    };
    /** @enum {string} */
    ThemePreferenceInput: 'light' | 'dark' | 'system';
    UserSettingsInput: {
      /** @enum {string} */
      device: 'phone' | 'desktop';
      settings: {
        /** @enum {string} */
        theme: 'light' | 'dark' | 'system';
        accentColor?: string;
        /** @enum {string} */
        defaultLayout: 'grid' | 'list';
        /** @enum {string} */
        gridCardSize: 'large' | 'medium' | 'small';
      };
      updatedAt: string | null;
    };
    UserSettingsPatchInput: {
      /** @enum {string} */
      theme?: 'light' | 'dark' | 'system';
      accentColor?: string;
      /** @enum {string} */
      defaultLayout?: 'grid' | 'list';
      /** @enum {string} */
      gridCardSize?: 'large' | 'medium' | 'small';
    };
    UserSettingsPayloadInput: {
      /** @enum {string} */
      theme: 'light' | 'dark' | 'system';
      accentColor?: string;
      /** @enum {string} */
      defaultLayout: 'grid' | 'list';
      /** @enum {string} */
      gridCardSize: 'large' | 'medium' | 'small';
    };
    UserSettingsResponseInput: {
      data: {
        /** @enum {string} */
        device: 'phone' | 'desktop';
        settings: {
          /** @enum {string} */
          theme: 'light' | 'dark' | 'system';
          accentColor?: string;
          /** @enum {string} */
          defaultLayout: 'grid' | 'list';
          /** @enum {string} */
          gridCardSize: 'large' | 'medium' | 'small';
        };
        updatedAt: string | null;
      };
    };
    UserSettingsUpsertRequest: {
      /** @enum {string} */
      theme?: 'light' | 'dark' | 'system';
      accentColor?: string;
      /** @enum {string} */
      defaultLayout?: 'grid' | 'list';
      /** @enum {string} */
      gridCardSize?: 'large' | 'medium' | 'small';
    };
    UserSettingsUpsertRequestInput: {
      /** @enum {string} */
      theme?: 'light' | 'dark' | 'system';
      accentColor?: string;
      /** @enum {string} */
      defaultLayout?: 'grid' | 'list';
      /** @enum {string} */
      gridCardSize?: 'large' | 'medium' | 'small';
    };
    VariantDetailInput: {
      id: string;
      variantNumber: string;
      rarity: string;
      variantType: string;
      variantLabel: string;
      foilMode: string;
      /** Format: uri */
      imageUrl: string;
      cardmarketId: number | null;
      tcgplayerId: number | null;
      releaseDate: string | null;
      artist: string | null;
      prices: {
        /** @enum {string} */
        currency: 'EUR';
        low: number | null;
        market: number | null;
        avg7d: number | null;
        isFoil: boolean;
      }[];
    };
    VariantNumber: string;
    VariantNumberInput: string;
    WishlistItemInput: {
      id: string;
      variantNumber: string;
      priority: number;
      targetPriceCents: number | null;
      notes: string | null;
      /** Format: date-time */
      addedAt: string;
      name: string;
      imageUrl: string;
      setCode: string;
      rarity: string;
      variantLabel: string;
    };
    WishlistItemResponseInput: {
      data: {
        id: string;
        variantNumber: string;
        priority: number;
        targetPriceCents: number | null;
        notes: string | null;
        /** Format: date-time */
        addedAt: string;
        name: string;
        imageUrl: string;
        setCode: string;
        rarity: string;
        variantLabel: string;
      };
    };
    WishlistListResponseInput: {
      data: {
        id: string;
        variantNumber: string;
        priority: number;
        targetPriceCents: number | null;
        notes: string | null;
        /** Format: date-time */
        addedAt: string;
        name: string;
        imageUrl: string;
        setCode: string;
        rarity: string;
        variantLabel: string;
      }[];
      meta: {
        total: number;
      };
    };
    WishlistUpsertRequestInput: {
      variantNumber: string;
      /** @default 0 */
      priority: number;
      targetPriceCents?: number | null;
      notes?: string | null;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  root: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  accountInfo: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  callbackOAuth: {
    parameters: {
      query?: {
        code?: string;
        error?: string;
        device_id?: string;
        error_description?: string;
        state?: string;
        user?: string;
        iss?: string;
      };
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  callbackOAuthPost: {
    parameters: {
      query?: {
        code?: string;
        error?: string;
        device_id?: string;
        error_description?: string;
        state?: string;
        user?: string;
        iss?: string;
      };
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        'application/json': {
          code?: string;
          error?: string;
          device_id?: string;
          error_description?: string;
          state?: string;
          user?: string;
          iss?: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  changeEmail: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /**
           * Format: email
           * @description The new email address to set must be a valid email address
           */
          newEmail: string;
          /** @description The URL to redirect to after email verification */
          callbackURL?: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  changePassword: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description The new password to set */
          newPassword: string;
          /** @description The current password is required */
          currentPassword: string;
          /** @description Must be a boolean value */
          revokeOtherSessions?: boolean;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  deleteUser: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description The callback URL to redirect to after the user is deleted */
          callbackURL?: string;
          /** @description The password of the user is required to delete the user */
          password?: string;
          /** @description The token to delete the user is required */
          token?: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  deleteUserCallback: {
    parameters: {
      query: {
        token: string;
        callbackURL?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  changeEmailEmailOTP: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description New email address to verify and change to */
          newEmail: string;
          /** @description OTP sent to the new email */
          otp: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  checkVerificationOTP: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Email address the OTP was sent to */
          email: string;
          /**
           * @description Type of the OTP
           * @enum {string}
           */
          type: 'email-verification' | 'sign-in' | 'forget-password' | 'change-email';
          /** @description OTP to verify */
          otp: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  requestEmailChangeEmailOTP: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description New email address to send the OTP */
          newEmail: string;
          /** @description OTP sent to the current email. This is required if changeEmail.verifyCurrentEmail option is set to true */
          otp?: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  requestPasswordResetEmailOTP: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Email address to send the OTP */
          email: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  resetPasswordEmailOTP: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Email address to reset the password */
          email: string;
          /** @description OTP sent to the email */
          otp: string;
          /** @description New password */
          password: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  sendVerificationOTP: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Email address to send the OTP */
          email: string;
          /**
           * @description Type of the OTP
           * @enum {string}
           */
          type: 'email-verification' | 'sign-in' | 'forget-password' | 'change-email';
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  verifyEmailOTP: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Email address to verify */
          email: string;
          /** @description OTP to verify */
          otp: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  error: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  expoAuthorizationProxy: {
    parameters: {
      query: {
        authorizationURL: string;
        oauthState?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  forgetPasswordEmailOTP: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Email address to send the OTP */
          email: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  getAccessToken: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json':
          | {
              /** @description The Better Auth account ID */
              accountId: string;
              /** @description The user ID associated with the account */
              userId?: string;
            }
          | {
              /**
               * @description Select the current OAuth account from its signed cookie
               * @enum {boolean}
               */
              useAccountCookie: true;
              /** @description The user ID associated with the account */
              userId?: string;
            };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  getSession: {
    parameters: {
      query?: {
        disableCookieCache?: boolean;
        disableRefresh?: boolean;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SessionResponse'] | null;
        };
      };
    };
  };
  getSessionPost: {
    parameters: {
      query?: {
        disableCookieCache?: boolean;
        disableRefresh?: boolean;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SessionResponse'] | null;
        };
      };
    };
  };
  linkSocialAccount: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description The URL to redirect to after the user has signed in */
          callbackURL?: string;
          provider:
            | (
                | 'apple'
                | 'atlassian'
                | 'cloudflare'
                | 'cognito'
                | 'discord'
                | 'facebook'
                | 'figma'
                | 'github'
                | 'microsoft'
                | 'google'
                | 'huggingface'
                | 'slack'
                | 'spotify'
                | 'twitch'
                | 'twitter'
                | 'dropbox'
                | 'kick'
                | 'linear'
                | 'linkedin'
                | 'gitlab'
                | 'tiktok'
                | 'reddit'
                | 'roblox'
                | 'salesforce'
                | 'vk'
                | 'zoom'
                | 'notion'
                | 'kakao'
                | 'naver'
                | 'line'
                | 'paybin'
                | 'paypal'
                | 'polar'
                | 'railway'
                | 'vercel'
                | 'wechat'
              )
            | string;
          idToken?: {
            token: string;
            nonce?: string;
            accessToken?: string;
            refreshToken?: string;
          };
          requestSignUp?: boolean;
          /** @description Additional scopes to request from the provider */
          scopes?: string[];
          /** @description The URL to redirect to if there is an error during the link process */
          errorCallbackURL?: string;
          /** @description Disable automatic redirection to the provider. Useful for handling the redirection yourself */
          disableRedirect?: boolean;
          /** @description The login hint to use for the authorization code request */
          loginHint?: string;
          /** @description Extra query parameters to append to the provider authorization URL (e.g. Cognito identity_provider, Google hd). */
          additionalParams?: {
            [key: string]: string;
          };
          additionalData?: {
            [key: string]: unknown;
          };
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  listUserAccounts: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  listSessions: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  ok: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @enum {boolean} */
            ok: true;
          };
        };
      };
    };
  };
  refreshToken: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json':
          | {
              /** @description The Better Auth account ID */
              accountId: string;
              /** @description The user ID associated with the account */
              userId?: string;
            }
          | {
              /**
               * @description Select the current OAuth account from its signed cookie
               * @enum {boolean}
               */
              useAccountCookie: true;
              /** @description The user ID associated with the account */
              userId?: string;
            };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  requestPasswordReset: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /**
           * Format: email
           * @description The email address of the user to send a password reset email to
           */
          email: string;
          /** @description The URL to redirect the user to reset their password. If the token isn't valid or expired, it'll be redirected with a query parameter `?error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter `?token=VALID_TOKEN */
          redirectTo?: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  resetPassword: {
    parameters: {
      query?: {
        token?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description The new password to set */
          newPassword: string;
          /** @description The token to reset the password */
          token?: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  requestPasswordResetCallback: {
    parameters: {
      query: {
        callbackURL: string;
      };
      header?: never;
      path: {
        token: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  revokeOtherSessions: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  revokeSession: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description The token to revoke */
          token: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  revokeSessions: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  sendVerificationEmail: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /**
           * Format: email
           * @description The email to send the verification email to
           */
          email: string;
          /** @description The URL to use for email verification callback */
          callbackURL?: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  signInEmail: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Email of the user */
          email: string;
          /** @description Password of the user */
          password: string;
          /** @description Callback URL to use as a redirect for email verification */
          callbackURL?: string;
          /**
           * @description If this is false, the session will not be remembered. Default is `true`.
           * @default true
           */
          rememberMe?: boolean;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SignInResponse'];
        };
      };
    };
  };
  signInEmailOTP: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Email address to sign in */
          email: string;
          /** @description OTP sent to the email */
          otp: string;
          /** @description User display name. Only used if the user is registering for the first time. Eg: "my-name" */
          name?: string;
          /** @description User profile image URL. Only used if the user is registering for the first time. */
          image?: string;
        } & {
          [key: string]: unknown;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  signInSocial: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description Callback URL to redirect to after the user has signed in */
          callbackURL?: string;
          newUserCallbackURL?: string;
          /** @description Callback URL to redirect to if an error happens */
          errorCallbackURL?: string;
          provider:
            | (
                | 'apple'
                | 'atlassian'
                | 'cloudflare'
                | 'cognito'
                | 'discord'
                | 'facebook'
                | 'figma'
                | 'github'
                | 'microsoft'
                | 'google'
                | 'huggingface'
                | 'slack'
                | 'spotify'
                | 'twitch'
                | 'twitter'
                | 'dropbox'
                | 'kick'
                | 'linear'
                | 'linkedin'
                | 'gitlab'
                | 'tiktok'
                | 'reddit'
                | 'roblox'
                | 'salesforce'
                | 'vk'
                | 'zoom'
                | 'notion'
                | 'kakao'
                | 'naver'
                | 'line'
                | 'paybin'
                | 'paypal'
                | 'polar'
                | 'railway'
                | 'vercel'
                | 'wechat'
              )
            | string;
          /** @description Disable automatic redirection to the provider. Useful for handling the redirection yourself */
          disableRedirect?: boolean;
          idToken?: {
            /** @description ID token from the provider */
            token: string;
            /** @description Nonce used to generate the token */
            nonce?: string;
            /** @description Access token from the provider */
            accessToken?: string;
            /** @description Refresh token from the provider */
            refreshToken?: string;
            /** @description Expiry date of the token */
            expiresAt?: number;
            /** @description The user object from the provider. Only available for some providers like Apple. */
            user?: {
              name?: {
                firstName?: string;
                lastName?: string;
              };
              email?: string;
            };
          };
          /** @description Array of scopes to request from the provider. This will override the default scopes passed. */
          scopes?: string[];
          /** @description Explicitly request sign-up. Useful when disableImplicitSignUp is true for this provider */
          requestSignUp?: boolean;
          /** @description The login hint to use for the authorization code request */
          loginHint?: string;
          /** @description Extra query parameters to append to the provider authorization URL (e.g. Cognito identity_provider, Google hd). */
          additionalParams?: {
            [key: string]: string;
          };
          /** @description Additional data to be passed through the OAuth flow */
          additionalData?: {
            [key: string]: unknown;
          };
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  signOut: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: {
      content: {
        'application/json': {
          /** @description The URL to redirect to after provider logout */
          callbackURL?: string;
          /** @description Return the provider logout URL without redirecting */
          disableRedirect?: boolean;
          /** @description State to pass to the provider logout endpoint */
          state?: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  signUpEmail: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          name: string;
          /** Format: email */
          email: string;
          password: string;
          image?: string;
          callbackURL?: string;
          rememberMe?: boolean;
        } & {
          [key: string]: unknown;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SignUpResponse'];
        };
      };
    };
  };
  unlinkAccount: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description The Better Auth account ID to unlink */
          accountId: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  updateSession: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          [key: string]: unknown;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  updateUser: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          [key: string]: unknown;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  verifyEmail: {
    parameters: {
      query: {
        token: string;
        callbackURL?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  verifyPassword: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @description The password to verify */
          password: string;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
    };
  };
  listCards: {
    parameters: {
      query?: {
        q?: string;
        sets?: string;
        colors?: string;
        colorMode?: 'all' | 'within';
        types?: string;
        super?: string;
        variants?: string;
        rarities?: string;
        energyMin?: number;
        energyMax?: number;
        powerMin?: number;
        powerMax?: number;
        mightMin?: number;
        mightMax?: number;
        page?: number;
        limit?: number;
        sortBy?: 'name' | 'energy' | 'variantNumber' | 'releaseDate' | 'price';
        dir?: 'asc' | 'desc';
        refresh?: 'true' | 'false';
        excludeTokens?: 'true' | 'false';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CardsListResponse'];
        };
      };
    };
  };
  batchCards: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CardsBatchRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CardsBatchResponse'];
        };
      };
    };
  };
  getCatalogIndex: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CatalogIndexResponse'];
        };
      };
    };
  };
  getCard: {
    parameters: {
      query?: {
        refresh?: 'true' | 'false';
      };
      header?: never;
      path: {
        variantNumber: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CardDetailResponse'];
        };
      };
    };
  };
  listCollection: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionListResponse'];
        };
      };
    };
  };
  collectionActivityHistory: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CollectionActivityHistoryRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionActivityHistoryResponse'];
        };
      };
    };
  };
  listCollectionAudit: {
    parameters: {
      query?: {
        limit?: number;
        before?: string;
        variantNumber?: string;
        actorUserId?: string;
        mine?: boolean | ('true' | 'false' | '1' | '0');
        action?:
          | 'add'
          | 'remove'
          | 'upsert'
          | 'delete'
          | 'clear'
          | 'batch'
          | 'import'
          | 'share_merge'
          | 'share_discard'
          | 'share_leave';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionAuditListResponse'];
        };
      };
    };
  };
  listPersonalCollectionAudit: {
    parameters: {
      query?: {
        limit?: number;
        before?: string;
        variantNumber?: string;
        actorUserId?: string;
        mine?: boolean | ('true' | 'false' | '1' | '0');
        action?:
          | 'add'
          | 'remove'
          | 'upsert'
          | 'delete'
          | 'clear'
          | 'batch'
          | 'import'
          | 'share_merge'
          | 'share_discard'
          | 'share_leave';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionAuditListResponse'];
        };
      };
    };
  };
  syncCollectionBatch: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CollectionBatchSyncRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionBatchSyncResponse'];
        };
      };
    };
  };
  collectionEvents: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'text/event-stream': unknown;
        };
      };
    };
  };
  exportCollection: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'text/csv': string;
        };
      };
    };
  };
  importCollection: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CollectionImportRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionImportResponse'];
        };
      };
    };
  };
  previewCollectionImport: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CollectionImportPreviewRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionImportPreviewResponse'];
        };
      };
    };
  };
  collectionQuantities: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CollectionQuantitiesRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionQuantitiesResponse'];
        };
      };
    };
  };
  recentCollectionActivity: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CollectionQuantitiesRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionRecentAddsResponse'];
        };
      };
    };
  };
  collectionSharingStatus: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionShareStatusResponse'];
        };
      };
    };
  };
  createCollectionInvite: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionShareInviteCreateResponse'];
        };
      };
    };
  };
  revokeCollectionInvite: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['OkResponse'];
        };
      };
    };
  };
  previewCollectionInvite: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        token: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionShareInvitePreviewResponse'];
        };
      };
    };
  };
  acceptCollectionInvite: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        token: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CollectionShareAcceptRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionShareAcceptResponse'];
        };
      };
    };
  };
  leaveSharedCollection: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionShareLeaveResponse'];
        };
      };
    };
  };
  setCollectionItem: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        variantNumber: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        'application/json': {
          acquiredPriceCents?: number | null;
          /** @default 1 */
          quantity?: number;
          /**
           * @default near_mint
           * @enum {string}
           */
          condition?:
            | 'mint'
            | 'near_mint'
            | 'lightly_played'
            | 'moderately_played'
            | 'heavily_played'
            | 'damaged'
            | 'unspecified';
          /** @default en */
          language?: string;
          isFoil?: boolean;
          notes?: string | null;
          isGraded?: boolean;
          gradeCompany?: string | null;
          gradeScore?: string | null;
          acquiredAt?: string | null;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionMutationResponse'];
        };
      };
    };
  };
  deleteCollectionItem: {
    parameters: {
      query?: {
        condition?:
          | 'mint'
          | 'near_mint'
          | 'lightly_played'
          | 'moderately_played'
          | 'heavily_played'
          | 'damaged'
          | 'unspecified';
        language?: string;
        isFoil?: 'true' | 'false';
      };
      header?: never;
      path: {
        variantNumber: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['OkResponse'];
        };
      };
    };
  };
  addCollectionItem: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        variantNumber: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        'application/json': components['schemas']['CollectionAdjustRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionMutationResponse'];
        };
      };
    };
  };
  removeCollectionItem: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        variantNumber: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        'application/json': components['schemas']['CollectionAdjustRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CollectionMutationResponse'];
        };
      };
    };
  };
  getDeckRules: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeckRulesResponse'];
        };
      };
    };
  };
  validateDeck: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['DeckValidateInputInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeckValidateResponse'];
        };
      };
    };
  };
  listDecks: {
    parameters: {
      query?: {
        q?: string;
        legend?: string;
        sets?: string;
        isLegal?: 'true' | 'false';
        hasGuide?: 'true' | 'false';
        hasVideo?: 'true' | 'false';
        hasMatchups?: 'true' | 'false';
        page?: number;
        limit?: number;
        sort?: 'trending' | 'likes' | 'views' | 'createdAt' | 'editedAt';
        dir?: 'asc' | 'desc';
        source?: 'owned' | 'imported' | 'all';
        preview?: 'true' | 'false';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeckListResponse'];
        };
      };
    };
  };
  getDeck: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeckDetailResponse'];
        };
      };
    };
  };
  saveDeck: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['DeckUpsertRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeckDetailResponse'];
        };
      };
    };
  };
  deleteDeck: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['IdResponse'];
        };
      };
    };
  };
  importDeck: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeckDetailResponse'];
        };
      };
    };
  };
  createDeckVersion: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateDeckVersionRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeckDetailResponse'];
        };
      };
    };
  };
  saveDeckVersion: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
        versionId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['DeckUpsertRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeckDetailResponse'];
        };
      };
    };
  };
  deleteDeckVersion: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
        versionId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeckDetailResponse'];
        };
      };
    };
  };
  renameDeckVersion: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
        versionId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['RenameDeckVersionRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeckDetailResponse'];
        };
      };
    };
  };
  activateDeckVersion: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
        versionId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DeckDetailResponse'];
        };
      };
    };
  };
  catalogFilters: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['FiltersResponse'];
        };
      };
    };
  };
  getHealth: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HealthResponse'];
        };
      };
    };
  };
  setWishlistItem: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        variantNumber: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        'application/json': {
          notes?: string | null;
          /** @default 0 */
          priority?: number;
          targetPriceCents?: number | null;
        };
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['WishlistItemResponse'];
        };
      };
    };
  };
  deleteWishlistItem: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        variantNumber: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['OkResponse'];
        };
      };
    };
  };
  listPrices: {
    parameters: {
      query?: {
        cardmarketId?: number;
        variantNumber?: string;
        isFoil?: 'true' | 'false';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['PricesListResponse'];
        };
      };
    };
  };
  getPriceHistory: {
    parameters: {
      query?: {
        cardmarketId?: number;
        variantNumber?: string;
        isFoil?: 'true' | 'false';
        days?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['PriceHistoryResponse'];
        };
      };
    };
  };
  getPriceStats: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['PriceStatsBatchRequestInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['PriceStatsBatchResponse'];
        };
      };
    };
  };
  downloadInternalRelease: {
    parameters: {
      query: {
        token: string;
      };
      header?: never;
      path: {
        filename: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'text/plain': string;
        };
      };
      302: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  headInternalRelease: {
    parameters: {
      query: {
        token: string;
      };
      header?: never;
      path: {
        filename: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      302: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  globalSearch: {
    parameters: {
      query: {
        q: string;
        types?: string;
        limit?: number;
        page?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['GlobalSearchResponse'];
        };
      };
    };
  };
  getUserSettings: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        device: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['UserSettingsResponse'];
        };
      };
    };
  };
  setUserSettings: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        device: string;
      };
      cookie?: never;
    };
    requestBody?: {
      content: {
        'application/json': components['schemas']['UserSettingsPatchInput'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['UserSettingsResponse'];
        };
      };
    };
  };
  syncCatalog: {
    parameters: {
      query?: {
        force?: 'true' | '1' | 'false' | '0';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SyncCatalogResponse'];
        };
      };
    };
  };
  syncPrices: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SyncPricesResponse'];
        };
      };
    };
  };
  getSyncStatus: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SyncStatusResponse'];
        };
      };
    };
  };
  listWishlist: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['WishlistListResponse'];
        };
      };
    };
  };
  getImage: {
    parameters: {
      query?: {
        w?: number;
      };
      header?: never;
      path: {
        key: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'image/webp': unknown;
        };
      };
      302: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      304: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
}
