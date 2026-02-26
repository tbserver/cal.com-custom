FROM=$1
TO=$2

if [ "${FROM}" = "${TO}" ]; then
    echo "Nothing to replace, the value is already set to ${TO}."
    exit 0
fi

echo "Replacing all statically built instances of $FROM with $TO."

# Use find + grep to handle filenames with special characters (brackets, etc.)
find apps/web/.next/ apps/web/public/ -type f -print0 2>/dev/null \
    | xargs -0 grep -l "${FROM}" 2>/dev/null \
    | while IFS= read -r file; do
        sed -i -e "s|$FROM|$TO|g" "$file"
    done
