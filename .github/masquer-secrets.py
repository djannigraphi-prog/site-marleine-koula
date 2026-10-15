"""Garde uniquement les lignes d'erreur d'un journal et masque toute valeur secrète.
Les valeurs exactes des secrets (variables S1, S2, S3) et tout ce qui ressemble à une clé sont remplacés par ***."""
import os, re, sys

secrets = [v for v in (os.environ.get(k, "") for k in ("S1", "S2", "S3")) if len(v) >= 6]
# Variantes d'un secret mal collé (avec guillemets, en-tête, espaces) : on masque aussi chaque morceau long.
morceaux = set()
for v in secrets:
    morceaux.add(v)
    morceaux.update(m for m in re.split(r'[\s"\']+', v) if len(m) >= 12)
motifs = re.compile(r"(Bearer\s+\S+|cfut_\S+|cfat_\S+|github_pat_\S+|gh[pousr]_\S+|\b[A-Fa-f0-9]{32,}\b|\b[A-Za-z0-9_\-]{40,}\b)")
garder = re.compile(r"(✘|ERROR|Error|error|Authentication|authorization|Authorization|permission|Permission|code: ?\d+|denied|invalid|Unable|failed)")

lignes = [l.rstrip("\n") for l in sys.stdin if garder.search(l)]
sortie = []
for l in lignes[-15:]:
    for m in sorted(morceaux, key=len, reverse=True):
        l = l.replace(m, "***")
    l = motifs.sub("***", l)
    l = re.sub(r"\x1b\[[0-9;]*m", "", l)
    sortie.append(l[:300])
print("\n".join(sortie))
