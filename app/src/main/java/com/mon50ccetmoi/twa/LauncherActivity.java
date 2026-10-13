/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.mon50ccetmoi.twa;

import android.net.Uri;

/**
 * Hérite de la LauncherActivity officielle d'androidbrowserhelper, qui conserve
 * toutes ses protections (validation des URL d'intent, filtrage des partages,
 * prompt de mise à jour Chrome) et active déjà le bord-à-bord
 * (WindowCompat.enableEdgeToEdge) dans son onCreate().
 * Aucun appel direct aux API de fenêtrage obsolètes n'est fait ici.
 */
public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    @Override
    protected Uri getLaunchingUrl() {
        return super.getLaunchingUrl();
    }
}
