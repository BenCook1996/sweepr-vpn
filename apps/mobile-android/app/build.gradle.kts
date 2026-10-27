import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val localProps = Properties().apply {
    val propFile = rootProject.file("local.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    namespace = "com.sweepr.vpn"
    compileSdk = 36

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    defaultConfig {
        applicationId = "com.sweepr.vpn"
        minSdk = 26
        targetSdk = 36
        versionCode = 13
        versionName = "2.4.1"

        resourceConfigurations += listOf("en", "de", "fr", "ja")
    }

    signingConfigs {
        create("release") {
            val ksFile = file("upload-keystore.jks")
            val ksPassword = System.getenv("KEYSTORE_PASSWORD")
                ?: localProps.getProperty("RELEASE_STORE_PASSWORD", "")
            if (ksFile.exists() && ksPassword.isNotBlank()) {
                storeFile = ksFile
                storePassword = ksPassword
                keyAlias = System.getenv("KEY_ALIAS")
                    ?: localProps.getProperty("RELEASE_KEY_ALIAS", "sweeprvpn")
                keyPassword = System.getenv("KEY_PASSWORD")
                    ?: localProps.getProperty("RELEASE_KEY_PASSWORD", ksPassword)
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            val relSigning = signingConfigs.getByName("release")
            signingConfig = if (relSigning.storeFile?.exists() == true && !relSigning.storePassword.isNullOrBlank()) {
                relSigning
            } else {
                signingConfigs.getByName("debug")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            val relSigning = signingConfigs.getByName("release")
            if (relSigning.storeFile?.exists() == true && !relSigning.storePassword.isNullOrBlank()) {
                signingConfig = relSigning
            }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    lint {
        checkReleaseBuilds = true
        abortOnError = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.fragment:fragment-ktx:1.6.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation(platform("androidx.compose:compose-bom:2024.04.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
    implementation("com.android.billingclient:billing-ktx:8.0.0")
    implementation("com.google.android.play:app-update-ktx:2.1.0")
}

configurations.all {
    resolutionStrategy {
        force("com.android.billingclient:billing:8.0.0")
        force("com.android.billingclient:billing-ktx:8.0.0")
    }
}
