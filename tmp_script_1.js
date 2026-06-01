
        window.mapsSDKLoaded = false;
        
        window.initMap = function() {
            console.log("mon50cc Maps : SDK ChargÃ© avec succÃ¨s.");
            window.mapsSDKLoaded = true;
            if (typeof window.initMapController === "function") {
                window.initMapController();
            }
        };

        function loadMapsSDK() {
            const isAndroid = /Android/i.test(navigator.userAgent);
            const selectedKey = (typeof CONFIG !== 'undefined' && CONFIG.MAPS) ? (isAndroid ? CONFIG.MAPS.ANDROID : CONFIG.MAPS.PC) : "";
            
            if (!selectedKey) {
                console.error("mon50cc Loader : ClÃ© API Maps manquante !");
                forceStartApp("ERREUR_CONFIG_API");
                return;
            }

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${selectedKey}&libraries=geometry,places,marker&v=beta&callback=initMap&loading=async`;
            script.async = true;
            script.defer = true;
            script.onerror = function() {
                console.error("mon50cc Loader : Ã‰chec critique du chargement Maps SDK.");
                forceStartApp("Ã‰CHEC_RÃ‰SEAU_SDK");
            };
            document.head.appendChild(script);
        }

        function forceStartApp(reason) {
            console.warn("mon50cc : DÃ©marrage forcÃ© (" + reason + ")");
            const statusEl = document.getElementById('loader-status');
            if(statusEl) statusEl.textContent = "Lancement (Mode DÃ©gradÃ©)...";
            
            // On s'assure que checkAuth est dÃ©fini (fail-safe)
            if (typeof window.checkAuth !== "function") {
                window.checkAuth = () => { return { username: "Pilote", isGuest: true }; };
            }

            setTimeout(() => {
                if (typeof window.startApp === "function") window.startApp();
            }, 500);
        }

        // --- CORE NAVIGATION (ULTIMATE BYPASS) ---
        window.toggleMenu = function() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('overlay');
            if (sidebar) {
                sidebar.classList.toggle('active');
                if (overlay) overlay.classList.toggle('active');
                console.log("mon50cc : Menu Toggle (Bypass Mode)");
            }
        };

        // --- CACHE PURGE FORCE ---
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for(let registration of registrations) {
                    if (window.location.search.includes('purge=true')) {
                        registration.unregister();
                        console.log("mon50cc : Service Worker Unregistered (Purge Mode)");
                    }
                }
            });
        }

        // On lance le chargement dÃ¨s que config.js est lÃ 
        window.addEventListener('load', () => {
            loadMapsSDK();
            // Fail-safe global rÃ©duit Ã  4s pour une meilleure UX
            setTimeout(() => {
                if (!window.mapsSDKLoaded) forceStartApp("TIMEOUT_SDK");
            }, 4000);

            // ULTIMATE FAIL-SAFE: Masquer le loader quoi qu'il arrive aprÃ¨s 7s
            setTimeout(() => {
                const loader = document.getElementById('app-loader');
                if (loader && loader.style.visibility !== 'hidden') {
                    console.warn("mon50cc : Force-Hiding Loader (Ultimate Fail-safe)");
                    loader.style.opacity = '0';
                    setTimeout(() => loader.style.visibility = 'hidden', 800);
                }
            }, 7000);
        });
    