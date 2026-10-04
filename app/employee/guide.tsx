'use client'

import { useEffect } from 'react'

// Mode d'emploi affiché aux employés (bouton « Mode d'emploi » en haut de leur page).

const h2: React.CSSProperties = { fontSize: '1.05rem', fontWeight: 700, color: 'var(--terracotta)', margin: '1.75rem 0 0.6rem' }
const p: React.CSSProperties = { margin: '0 0 0.7rem', lineHeight: 1.55 }
const list: React.CSSProperties = { margin: '0 0 0.8rem', paddingLeft: '1.3rem', lineHeight: 1.55 }
const li: React.CSSProperties = { marginBottom: '0.35rem' }
const note: React.CSSProperties = { background: '#FFF5F0', border: '1px solid #FDDCCA', borderRadius: '0.5rem', padding: '0.65rem 0.8rem', margin: '0 0 0.8rem', lineHeight: 1.5, fontSize: '0.92rem' }

export default function EmployeeGuide({ onClose }: { onClose: () => void }) {
  // Bloque le défilement de la page derrière et ferme avec la touche Échap
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label="Mode d'emploi" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, background: 'var(--terracotta)', color: 'white', height: 56, padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
        <div style={{ fontWeight: 700 }}>📖 Mode d&apos;emploi</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.18)', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.4rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}>✕ Fermer</button>
      </div>

      <main style={{ padding: '1.25rem 1.25rem 3rem', maxWidth: 640, margin: '0 auto', color: 'var(--text)' }}>
        <p style={p}>
          L&apos;application sert à déclarer chaque dépense et chaque encaissement du riad, avec sa facture ou son ticket,
          et à suivre le fond de caisse. Tout se fait depuis le téléphone, en quatre onglets : Dépense, Encaissement,
          Fond de caisse, Mon historique.
        </p>

        <h2 style={h2}>1. Se connecter</h2>
        <p style={p}>Chaque employé a son propre lien, envoyé par Valérie ou Nicolas. Il n&apos;y a pas de mot de passe : le lien suffit, il ne faut donc pas le partager.</p>
        <ol style={list}>
          <li style={li}>Ouvrez votre lien sur votre téléphone.</li>
          <li style={li}>Ajoutez-le à l&apos;écran d&apos;accueil pour le retrouver comme une application :
            <ul style={{ ...list, margin: '0.3rem 0 0' }}>
              <li style={li}>iPhone (Safari) : bouton Partager, puis « Sur l&apos;écran d&apos;accueil ».</li>
              <li style={li}>Android (Chrome) : menu ⋮, puis « Ajouter à l&apos;écran d&apos;accueil ».</li>
            </ul>
          </li>
          <li style={li}>Votre prénom s&apos;affiche en haut : toutes vos saisies sont enregistrées à votre nom.</li>
        </ol>
        <p style={p}>Si la page affiche « Contactez votre manager pour obtenir votre lien », le lien est incomplet ou n&apos;est plus actif : demandez-en un nouveau.</p>

        <h2 style={h2}>2. Saisir une dépense (onglet 💳 Dépense)</h2>
        <p style={p}>Commencez toujours par la photo de la facture : l&apos;application lit le document et remplit la date, le fournisseur et les montants à votre place.</p>
        <ol style={list}>
          <li style={li}>En haut du formulaire, touchez <b>📷 Photo</b> pour photographier la facture, ou <b>📁 Fichier</b> pour choisir une photo ou un PDF déjà enregistré.</li>
          <li style={li}>Attendez quelques secondes le message « Analyse en cours… » : les champs se remplissent tout seuls.</li>
          <li style={li}>Vérifiez et corrigez si besoin :
            <ul style={{ ...list, margin: '0.3rem 0 0' }}>
              <li style={li}><b>Date</b> : la date de la facture.</li>
              <li style={li}><b>Mode de paiement</b> : CB ou Espèces.</li>
              <li style={li}><b>Devise</b> : MAD ou EUR.</li>
              <li style={li}><b>Montant TTC</b> (obligatoire). Le montant HT et la TVA sont facultatifs.</li>
              <li style={li}><b>Fournisseur / Lieu</b> : le nom du magasin ou de l&apos;artisan.</li>
              <li style={li}><b>Catégorie</b> : Nourriture, Entretien, Travaux, Salaire, etc.</li>
              <li style={li}><b>Description</b> : une précision utile, par exemple « acompte 1/2 » ou « produits ménage ».</li>
            </ul>
          </li>
          <li style={li}>Touchez <b>Soumettre</b>. Le message vert confirme l&apos;enregistrement.</li>
        </ol>
        <p style={p}>La facture est <b>obligatoire</b> pour un paiement par CB. Elle est facultative pour les espèces, mais toujours préférable.</p>
        <p style={note}><b>Payer en espèces</b> : la dépense est automatiquement retirée du fond de caisse. Il ne faut donc pas faire de sortie de caisse en plus.</p>
        <p style={note}><b>Un ticket avec plusieurs types d&apos;achats</b> (supermarché : nourriture et produits d&apos;entretien, par exemple) : cochez <b>✂️ Ventiler ce ticket en plusieurs catégories</b> et répartissez le total, une ligne par catégorie. Pour les tickets de supermarché, l&apos;application propose souvent la répartition elle-même.</p>

        <h2 style={h2}>3. Saisir un encaissement (onglet 💵 Encaissement)</h2>
        <p style={p}>Un encaissement, c&apos;est de l&apos;argent reçu par le riad : un client qui paie un extra, un repas, un soin au spa…</p>
        <ol style={list}>
          <li style={li}>Choisissez le <b>mode de paiement</b> : 💳 CB ou 💵 Espèces.</li>
          <li style={li}>Joignez le ticket CB ou le reçu avec <b>📷 Photo</b> ou <b>📁 Fichier</b> : la date et le montant se remplissent tout seuls.</li>
          <li style={li}>Vérifiez la <b>date</b> et le <b>montant</b> :
            <ul style={{ ...list, margin: '0.3rem 0 0' }}>
              <li style={li}><b>CB</b> : saisissez le montant de la transaction, celui du ticket. L&apos;application déduit seule les frais bancaires de 3 % et affiche l&apos;encaissement perçu.</li>
              <li style={li}><b>Espèces</b> : saisissez le montant reçu, en MAD ou en EUR.</li>
            </ul>
          </li>
          <li style={li}>Choisissez la <b>catégorie</b>, puis ajoutez si possible le <b>nom du client</b> et une <b>description</b> (« dîner 2 pers. », « massage »…).</li>
          <li style={li}>Touchez <b>Soumettre</b>.</li>
        </ol>
        <p style={p}>Un encaissement en espèces est automatiquement ajouté au fond de caisse.</p>
        <p style={p}>Après l&apos;enregistrement, le bouton <b>📄 Générer la facture comptable</b> permet d&apos;imprimer ou d&apos;enregistrer une facture au nom du riad, à remettre au client s&apos;il en demande une.</p>

        <h2 style={h2}>4. Le fond de caisse (onglet 💰 Fond de caisse)</h2>
        <p style={p}>Le solde affiché est le même pour toute l&apos;équipe. Il est calculé automatiquement à partir des dépenses et encaissements payés en espèces, et des mouvements entre le coffre et la caisse.</p>
        <ul style={list}>
          <li style={li}>Le solde se met à jour tout seul toutes les 15 secondes. Touchez <b>Actualiser</b> pour le rafraîchir tout de suite ; l&apos;heure de la dernière mise à jour est indiquée.</li>
          <li style={li}>En vert : solde positif. En rouge : solde négatif, il manque probablement une saisie.</li>
        </ul>
        <p style={{ ...p, fontWeight: 600 }}>Faire le rapprochement de caisse (en fin de service, par exemple) :</p>
        <ol style={list}>
          <li style={li}>Comptez les billets et les pièces dans la caisse.</li>
          <li style={li}>Saisissez le total dans <b>MAD compté</b>, et dans <b>EUR compté</b> s&apos;il y a des euros.</li>
          <li style={li}>Lisez l&apos;<b>écart</b> : vert avec ✓, la caisse est juste ; rouge, il y a une différence.</li>
        </ol>
        <p style={p}>En cas d&apos;écart, cherchez d&apos;abord une dépense ou un encaissement en espèces oublié ou saisi deux fois (onglet Mon historique). Si l&apos;écart reste, prévenez Valérie ou Nicolas : ne corrigez pas la caisse vous-même.</p>

        <h2 style={h2}>5. Mon historique (onglet 📋 Mon historique)</h2>
        <p style={p}>Cet onglet liste tout ce que vous avez saisi, du plus récent au plus ancien.</p>
        <ul style={list}>
          <li style={li}><b>Dépenses &amp; Encaissements</b> : chaque saisie avec sa catégorie, son fournisseur, son mode de paiement, son montant et sa date. « 📄 Voir facture » ouvre le justificatif joint.</li>
          <li style={li}><b>Fond de caisse</b> : vos mouvements de caisse.</li>
        </ul>
        <p style={p}>Chaque saisie porte un statut :</p>
        <ul style={list}>
          <li style={li}><span className="badge-pending">En attente</span> : saisie reçue, pas encore vérifiée par Valérie ou Nicolas.</li>
          <li style={li}><span className="badge-validated">Validé</span> : saisie vérifiée et acceptée.</li>
        </ul>
        <p style={p}>Vérifiez votre historique après chaque saisie, surtout si vous n&apos;avez pas vu le message de confirmation : cela évite les oublis et les doublons.</p>

        <h2 style={h2}>6. Les règles à retenir</h2>
        <ol style={list}>
          <li style={li}><b>Une saisie par dépense ou encaissement, le jour même</b>, avant de jeter ou d&apos;égarer le ticket.</li>
          <li style={li}><b>Toujours une photo</b> de la facture ou du ticket, lisible et en entier.</li>
          <li style={li}><b>Jamais deux fois la même chose</b> : si un collègue a déjà saisi une dépense, ne la ressaisissez pas. En cas de doute, regardez votre historique ou demandez.</li>
          <li style={li}><b>Un retrait au distributeur</b> se saisit comme une dépense, catégorie Banque, avec la photo du ticket du distributeur.</li>
          <li style={li}><b>Une erreur ?</b> Vous ne pouvez pas modifier ni supprimer une saisie vous-même. Prévenez Valérie ou Nicolas en précisant la date et le montant : ils corrigent depuis leur interface.</li>
          <li style={li}><b>Ne partagez jamais votre lien</b> : toute saisie faite avec ce lien est enregistrée à votre nom.</li>
        </ol>

        <button onClick={onClose} className="btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>Retour à l&apos;application</button>
      </main>
    </div>
  )
}
