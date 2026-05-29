import os

workflow_dir = r"C:\Users\xavie\.gemini\antigravity\scratch\balade-app\.github\workflows"
if not os.path.exists(workflow_dir):
    os.makedirs(workflow_dir)

workflow_content = """name: Build Android App

on:
  push:
    branches: [ main ]
    paths:
      - 'android-app/**'
  workflow_dispatch: # Allows manual trigger

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: gradle

      - name: Grant execute permission for gradlew
        run: chmod +x android-app/android/gradlew

      - name: Build with Gradle (AAB)
        working-directory: ./android-app/android
        run: ./gradlew bundleRelease

      - name: Build with Gradle (APK)
        working-directory: ./android-app/android
        run: ./gradlew assembleRelease

      - name: Upload AAB (Google Play format)
        uses: actions/upload-artifact@v3
        with:
          name: app-release.aab
          path: android-app/android/app/build/outputs/bundle/release/app-release.aab

      - name: Upload APK (Direct install)
        uses: actions/upload-artifact@v3
        with:
          name: app-release.apk
          path: android-app/android/app/build/outputs/apk/release/app-release-unsigned.apk
"""

with open(os.path.join(workflow_dir, "android-build.yml"), "w", encoding="utf-8") as f:
    f.write(workflow_content)

print("Workflow created.")
