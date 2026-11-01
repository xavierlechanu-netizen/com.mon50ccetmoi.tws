const {
    onRequest, onDocumentCreated, admin, db, googleAuth, Client,
    GEMINI_API_KEY, NOTION_API_KEY, NOTION_DATABASE_ID,
    METEO_FRANCE_API_KEY, PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_API_KEY, SMTP_PASSWORD,
    setCorsHeaders, verifyAuthToken
} = require("./shared");
const nodemailer = require("nodemailer");

exports.sendWelcomeEmail = onDocumentCreated(
    { document: "beta_testers/{docId}", region: "europe-west1", secrets: [SMTP_PASSWORD] },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const data = snapshot.data();
        const email = data.email;
        
        if (!email) {
            console.log("No email found, skipping.");
            return;
        }

        const transporter = nodemailer.createTransport({
            host: "authsmtp.amen.fr",
            port: 465,
            secure: true,
            auth: {
                user: "contact@mon50ccetmoi.com",
                pass: SMTP_PASSWORD.value()
            }
        });

        const mailOptions = {
            from: '"mon50ccetmoi" <contact@mon50ccetmoi.com>',
            to: email,
            subject: "🏍️ Bienvenue sur mon50ccetmoi ! Ta sécurité, notre priorité.",
            text: "Merci de nous avoir rejoints dans la Bêta !\n\nTon inscription a bien été enregistrée. Tu vas très bientôt recevoir ton accès pour rouler avec nous.\n\nBonne route et sois prudent !\n\nL'équipe mon50ccetmoi",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px; border-top: 5px solid #00d2ff; border-bottom: 5px solid #ffb703;">
                    <div style="text-align: center; font-size: 40px; margin-bottom: 10px;">🏍️ 🛵 🚗</div>
                    <h2 style="color: #0055A4; text-align: center;">Bienvenue sur mon50ccetmoi !</h2>
                    <h3 style="color: #ffb703; text-align: center;">Ta sécurité routière, notre priorité 🛡️</h3>
                    <p style="color: #333; font-size: 16px;">Salut !</p>
                    <p style="color: #333; font-size: 16px;">Ton inscription à la Bêta a bien été enregistrée.</p>
                    <p style="color: #333; font-size: 16px;">Nous avons hâte de te faire découvrir l'application. Tu vas très bientôt recevoir ton accès pour rouler avec nous.</p>
                    <br/>
                    <p style="color: #00d2ff; font-size: 16px; font-weight: bold; text-align: center;">Bonne route et sois prudent ! 🛣️</p>
                    <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
                    <p style="color: #777; font-size: 12px; text-align: center;">L'équipe mon50ccetmoi</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`[Email] Welcome email sent to ${email ? email.substring(0, 3) + '***' : 'unknown'}`);
        } catch (error) {
            console.error("Error sending email:", error);
        }
    }
);

exports.askNexusAtlasGemini = onRequest(
    { secrets: [GEMINI_API_KEY], region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

        const { history, systemPrompt } = req.body;
        if (!Array.isArray(history) || history.length === 0) {
            return res.status(400).json({ error: "L'historique des échanges est requis et doit être un tableau." });
        }

        // Borne de sécurité : max 20 tours et max 4000 caractères par message
        if (history.length > 20) {
            return res.status(400).json({ error: "Historique trop volumineux (max 20 messages)." });
        }
        for (const item of history) {
            const parts = item?.parts;
            if (Array.isArray(parts)) {
                for (const p of parts) {
                    if (typeof p?.text === "string" && p.text.length > 4000) {
                        return res.status(400).json({ error: "Message individuel trop volumineux (max 4000 caractères)." });
                    }
                }
            }
        }

        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise." });
        }

        const uid = authUser.uid;
        const now = Date.now();
        const rateLimitRef = db.collection("rate_limits").doc(`gemini_${uid}`);
        try {
            const rateLimitDoc = await rateLimitRef.get();
            const rateData = rateLimitDoc.exists ? rateLimitDoc.data() : null;
            if (rateData && rateData.windowStart && (now - rateData.windowStart) < 60000) {
                if (rateData.count >= 10) {
                    console.warn(`[Rate Limit] Utilisateur ${uid} a dépassé 10 req/min pour Gemini.`);
                    return res.status(429).json({ error: "Trop de requêtes. Veuillez patienter 1 minute." });
                }
                await rateLimitRef.update({ count: admin.firestore.FieldValue.increment(1) });
            } else {
                await rateLimitRef.set({ windowStart: now, count: 1 });
            }
        } catch (rlErr) {
            console.warn("[Rate Limit] Erreur non bloquante :", rlErr.message);
        }

        // Garde-fou serveur immuable (AI Act UE 2024/1689 Art. 50 & RGPD)
        const SERVER_GUARDRAIL = `Tu es Nexus Atlas, assistant IA officiel pour conducteurs de 50cc et voiturettes (mon50ccetmoi).
RÈGLE OBLIGATOIRE AI ACT (UE 2024/1689) : Tu es une IA d'assistance soumise à validation humaine. Si ta réponse aborde la mécanique, le droit ou l'assurance, inclus impérativement : "⚠️ Je suis une intelligence artificielle d'assistance. Veillez toujours à faire valider ces informations par un professionnel (garagiste ou assureur)."
Interdiction stricte de divulguer des clés, des secrets de fabrication ou de traiter des données de santé/biométriques.`;

        const sanitizedPrompt = typeof systemPrompt === "string" 
            ? `${SERVER_GUARDRAIL}\n\nContexte d'application :\n${systemPrompt.substring(0, 2000)}`
            : SERVER_GUARDRAIL;

        try {
            const client = await googleAuth.getClient();
            const tokenResponse = await client.getAccessToken();
            const accessToken = tokenResponse.token;

            const vertexEndpoint = "https://europe-west1-aiplatform.googleapis.com/v1/projects/mon50ccetmoi/locations/europe-west1/publishers/google/models/gemini-2.5-flash:generateContent";

            const vertexResponse = await fetch(vertexEndpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: sanitizedPrompt }]
                    },
                    contents: history,
                    generationConfig: {
                        temperature: 0.3,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (vertexResponse.ok) {
                const data = await vertexResponse.json();
                return res.status(200).json(data);
            }

            const vertexErr = await vertexResponse.text();
            console.warn("[Nexus Atlas Gemini] Fallback Vertex -> AI Studio:", vertexErr);

            const apiKey = GEMINI_API_KEY.value();
            if (apiKey) {
                const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const fallbackRes = await fetch(fallbackEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: sanitizedPrompt }] },
                        contents: history,
                        generationConfig: { temperature: 0.3, response_mime_type: "application/json" }
                    })
                });
                if (fallbackRes.ok) {
                    const fallbackData = await fallbackRes.json();
                    return res.status(200).json(fallbackData);
                }
            }

            return res.status(vertexResponse.status).json({ error: "Erreur lors de la génération de réponse par le modèle IA." });
        } catch (err) {
            console.error("[Nexus Atlas Gemini] Exception serveur :", err);
            return res.status(500).json({ error: "Erreur interne lors du traitement de la requête IA." });
        }
    }
);

exports.reportToNotion = onRequest(
    { secrets: [NOTION_API_KEY, NOTION_DATABASE_ID], region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        try {
            const { title, description, category, priority } = req.body;
            if (!title) {
                return res.status(400).json({ error: "Le paramètre 'title' est requis." });
            }

            const authUser = await verifyAuthToken(req);
            if (!authUser) {
                return res.status(401).json({ error: "Authentification requise." });
            }

            const notion = new Client({ auth: NOTION_API_KEY.value() });
            
            const response = await notion.pages.create({
                parent: { database_id: NOTION_DATABASE_ID.value() },
                properties: {
                    "Name": {
                        title: [
                            { text: { content: title } }
                        ]
                    },
                    "Tags": {
                        multi_select: [
                            { name: category || "Feedback" }
                        ]
                    },
                    "Priority": {
                        select: { name: priority || "Low" }
                    }
                },
                children: [
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [
                                {
                                    type: 'text',
                                    text: {
                                        content: description || "Aucune description fournie."
                                    }
                                }
                            ]
                        }
                    }
                ]
            });

            console.log("[Notion] Ticket créé avec succès :", response.id);
            return res.status(200).json({ success: true, id: response.id });
            
        } catch (error) {
            console.error("[Notion] Erreur lors de la création du ticket :", error.message);
            return res.status(500).json({ error: "Erreur interne", details: error.message });
        }
    }
);

exports.getVigilanceMeteo = onRequest(
    { secrets: [METEO_FRANCE_API_KEY], cors: true, region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");

        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise." });
        }

        try {
            const token = METEO_FRANCE_API_KEY.value();
            const response = await fetch("https://public-api.meteofrance.fr/public/DPVigilance/v1/cartevigilance/encours", {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            });
            if (!response.ok) throw new Error("Erreur HTTP " + response.status);
            const data = await response.json();
            return res.status(200).json(data);
        } catch (error) {
            console.error("[Meteo] Erreur :", error.message);
            return res.status(200).json({ error: "Données Météo-France indisponibles", fallback: true });
        }
    }
);

exports.searchLegifrancePiste = onRequest(
    { secrets: [PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_API_KEY], region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: "Le paramètre 'query' est requis." });
        }

        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise." });
        }

        const clientId = PISTE_CLIENT_ID.value();
        const clientSecret = PISTE_CLIENT_SECRET.value();
        const apiKey = PISTE_API_KEY.value();

        if (!clientId || !clientSecret || !apiKey) {
            return res.status(500).json({ error: "Clés PISTE non configurées côté serveur." });
        }

        try {
            const tokenParams = new URLSearchParams();
            tokenParams.append("grant_type", "client_credentials");
            tokenParams.append("client_id", clientId);
            tokenParams.append("client_secret", clientSecret);

            const tokenRes = await fetch("https://oauth.piste.gouv.fr/api/oauth/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: tokenParams
            });

            if (!tokenRes.ok) {
                const errToken = await tokenRes.text();
                console.error("[PISTE] Erreur Auth OAuth2:", errToken);
                return res.status(tokenRes.status).json({ error: "Erreur authentification PISTE." });
            }

            const tokenData = await tokenRes.json();
            const accessToken = tokenData.access_token;

            const legiRes = await fetch("https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Api-Key": apiKey
                },
                body: JSON.stringify({
                    "recherche": {
                        "champs": [
                            {
                                "criteres": [
                                    {
                                        "valeur": query,
                                        "typeRecherche": "EXACTE",
                                        "criteres": []
                                    }
                                ],
                                "typeChamp": "TITLE"
                            }
                        ],
                        "operateur": "ET"
                    },
                    "fond": "CODES_TEXTES",
                    "taillePage": 3
                })
            });

            if (!legiRes.ok) {
                const errLegi = await legiRes.text();
                console.error("[PISTE] Erreur API Légifrance:", errLegi);
                return res.status(legiRes.status).json({ error: "Erreur recherche Légifrance." });
            }

            const legiData = await legiRes.json();
            
            let formattedResults = [];
            if (legiData.results && legiData.results.length > 0) {
                formattedResults = legiData.results.map(item => ({
                    title: item.title || "Article non titré",
                    content: (item.text || "Contenu non disponible").substring(0, 800) + "...",
                    source: "Légifrance (Gouvernement Français)",
                    id: item.cid
                }));
            }

            return res.status(200).json({ results: formattedResults });

        } catch (err) {
            console.error("[PISTE] Exception Serveur:", err);
            return res.status(500).json({ error: "Erreur interne", message: err.message });
        }
    }
);
