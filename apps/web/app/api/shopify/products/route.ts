import { NextResponse } from "next/server";

const SHOPIFY_STOREFRONT_DOMAIN = process.env.SHOPIFY_STOREFRONT_DOMAIN || "";
const SHOPIFY_STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN || "";
const SHOPIFY_COLLECTION_HANDLE = process.env.SHOPIFY_COLLECTION_HANDLE || "";

// In-memory cache: key → { data, timestamp }
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 120_000; // 2 minutes

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

const PRODUCTS_SEARCH_QUERY = `
  query SearchProducts($query: String!, $first: Int!, $after: String) {
    search(query: $query, types: PRODUCT, first: $first, after: $after) {
      edges {
        node {
          ... on Product {
            id
            title
            handle
            featuredImage {
              url
              altText
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            variants(first: 20) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  image {
                    url
                  }
                  availableForSale
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const COLLECTION_QUERY = `
  query CollectionProducts($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      products(first: $first, after: $after) {
        edges {
          node {
            id
            title
            handle
            featuredImage {
              url
              altText
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            variants(first: 20) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  image {
                    url
                  }
                  availableForSale
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const ALL_PRODUCTS_QUERY = `
  query AllProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: BEST_SELLING) {
      edges {
        node {
          id
          title
          handle
          featuredImage {
            url
            altText
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          variants(first: 20) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
                image {
                  url
                }
                availableForSale
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface ShopifyVariantNode {
  id: string;
  title: string;
  price: { amount: string; currencyCode: string };
  image: { url: string } | null;
  availableForSale: boolean;
}

interface ShopifyProductNode {
  id: string;
  title: string;
  handle: string;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  variants: { edges: { node: ShopifyVariantNode }[] };
}

async function shopifyFetch(query: string, variables: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`https://${SHOPIFY_STOREFRONT_DOMAIN}/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Shopify API ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function mapProducts(edges: { node: ShopifyProductNode }[]) {
  return edges.map(({ node }) => ({
    productId: node.id,
    title: node.title,
    handle: node.handle,
    image: node.featuredImage?.url || null,
    minPrice: node.priceRange.minVariantPrice.amount,
    currency: node.priceRange.minVariantPrice.currencyCode,
    variants: node.variants.edges
      .filter(({ node: v }) => v.availableForSale)
      .map(({ node: v }) => ({
        variantId: v.id,
        title: v.title,
        price: v.price.amount,
        currency: v.price.currencyCode,
        image: v.image?.url || null,
      })),
  }));
}

export async function GET(request: Request) {
  if (!SHOPIFY_STOREFRONT_DOMAIN || !SHOPIFY_STOREFRONT_TOKEN) {
    return NextResponse.json({ items: [], error: "Shopify not configured" });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const cursor = searchParams.get("cursor") || null;
  const limit = Math.min(Number(searchParams.get("limit")) || 24, 50);

  const cacheKey = `${q}|${cursor}|${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    let data;

    if (q) {
      // Search mode
      data = await shopifyFetch(PRODUCTS_SEARCH_QUERY, {
        query: q,
        first: limit,
        after: cursor,
      });
      const search = data?.data?.search;
      const items = mapProducts(search?.edges || []);
      const result = {
        items,
        nextCursor: search?.pageInfo?.hasNextPage ? search?.pageInfo?.endCursor : null,
      };
      setCache(cacheKey, result);
      return NextResponse.json(result);
    } else if (SHOPIFY_COLLECTION_HANDLE) {
      // Collection mode (default when no search)
      data = await shopifyFetch(COLLECTION_QUERY, {
        handle: SHOPIFY_COLLECTION_HANDLE,
        first: limit,
        after: cursor,
      });
      const collection = data?.data?.collection?.products;
      const items = mapProducts(collection?.edges || []);
      const result = {
        items,
        nextCursor: collection?.pageInfo?.hasNextPage ? collection?.pageInfo?.endCursor : null,
      };
      setCache(cacheKey, result);
      return NextResponse.json(result);
    } else {
      // All products (best selling)
      data = await shopifyFetch(ALL_PRODUCTS_QUERY, {
        first: limit,
        after: cursor,
      });
      const products = data?.data?.products;
      const items = mapProducts(products?.edges || []);
      const result = {
        items,
        nextCursor: products?.pageInfo?.hasNextPage ? products?.pageInfo?.endCursor : null,
      };
      setCache(cacheKey, result);
      return NextResponse.json(result);
    }
  } catch (err) {
    console.error("Shopify proxy error:", err);
    return NextResponse.json({ items: [], error: "Failed to fetch products" });
  }
}
