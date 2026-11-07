package com.mon50ccetmoi.twa;

import com.google.androidbrowserhelper.locationdelegation.LocationDelegationExtraCommandHandler;

public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();

        // Relais GPS : quand le site demande la position, Chrome passe par l'app,
        // qui a sa propre permission de localisation Android.
        registerExtraCommandHandler(new LocationDelegationExtraCommandHandler());
    }
}
