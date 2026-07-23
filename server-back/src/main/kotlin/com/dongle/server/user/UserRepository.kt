package com.dongle.server.user

import org.springframework.data.jpa.repository.JpaRepository

interface UserRepository : JpaRepository<User, Long> {
    fun findByOauthProviderAndOauthId(oauthProvider: OAuthProvider, oauthId: String): User?
}
