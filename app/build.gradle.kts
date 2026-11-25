plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.mizan.mariokart"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.mizan.mariokart"
        minSdk = 26
        targetSdk = 35
        versionCode = 6
        versionName = "1.3.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    val prodStoreFile = System.getenv("RELEASE_STORE_FILE")
        ?: (project.findProperty("RELEASE_STORE_FILE") as? String)
        ?: System.getenv("RELEASE_KEYSTORE_PATH")
        ?: (project.findProperty("RELEASE_KEYSTORE_PATH") as? String)
    val prodStorePassword = System.getenv("RELEASE_STORE_PASSWORD")
        ?: (project.findProperty("RELEASE_STORE_PASSWORD") as? String)
        ?: System.getenv("RELEASE_KEYSTORE_PASSWORD")
        ?: (project.findProperty("RELEASE_KEYSTORE_PASSWORD") as? String)
    val prodKeyAlias = System.getenv("RELEASE_KEY_ALIAS")
        ?: (project.findProperty("RELEASE_KEY_ALIAS") as? String)
    val prodKeyPassword = System.getenv("RELEASE_KEY_PASSWORD")
        ?: (project.findProperty("RELEASE_KEY_PASSWORD") as? String)

    val hasProductionSigning = !prodStoreFile.isNullOrBlank() &&
        file(prodStoreFile).exists() &&
        !prodStorePassword.isNullOrBlank() &&
        !prodKeyAlias.isNullOrBlank() &&
        !prodKeyPassword.isNullOrBlank()

    fun getOrCreateTestReleaseKeystore(): File {
        val signingDir = File(layout.buildDirectory.asFile.get(), "signing")
        signingDir.mkdirs()
        val testKeystore = File(signingDir, "test-release.jks")
        if (!testKeystore.exists()) {
            val process = ProcessBuilder(
                "keytool", "-genkeypair",
                "-keystore", testKeystore.absolutePath,
                "-storepass", "mariokart-test",
                "-alias", "mariokart-test-release",
                "-keypass", "mariokart-test",
                "-keyalg", "RSA",
                "-keysize", "2048",
                "-validity", "10000",
                "-dname", "CN=Mario Kart Local Test Release, OU=QA Test, O=Mario Kart Project, C=US"
            ).redirectErrorStream(true).start()
            val exitCode = process.waitFor()
            if (exitCode != 0) {
                throw GradleException("Failed to generate local test-release keystore")
            }
        }
        return testKeystore
    }

    signingConfigs {
        create("release") {
            enableV1Signing = true
            enableV2Signing = true
            if (hasProductionSigning) {
                storeFile = file(prodStoreFile!!)
                storePassword = prodStorePassword
                keyAlias = prodKeyAlias
                keyPassword = prodKeyPassword
                println("[Mario Kart] Release signing configured with PRODUCTION keystore: $prodStoreFile")
            } else {
                storeFile = getOrCreateTestReleaseKeystore()
                storePassword = "mariokart-test"
                keyAlias = "mariokart-test-release"
                keyPassword = "mariokart-test"
                println("[Mario Kart] Release signing configured with LOCAL TEST-RELEASE keystore (NOT production-signed).")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
