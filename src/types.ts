import { CommonEventProperties } from '@snowplow/tracker-core';

/**
 * Type/Schema for an ecommerce Action
 */
export interface Action {
  /**
   * Standard ecommerce actions
   */
  type:
    | 'add_to_cart'
    | 'remove_from_cart'
    | 'product_view'
    | 'list_click'
    | 'list_view'
    | 'promo_click'
    | 'promo_view'
    | 'checkout_step'
    | 'transaction'
    | 'refund'
    | 'site_search';

  /**
   * You can add a name for the list presented to the user.
   * E.g. product list, search results, shop the look, frequently bought with
   */
  name?: string;
}

/**
 * Type/Schema for a checkout_step event in Ecommerce
 */
export interface CheckoutStep {
  /* Checkout step index */
  step: number;
  /* Selection of 'existing user' or 'guest checkout' */
  account_type?: string;
  /* If opted in to marketing campaigns to the email address */
  marketing_opt_in?: boolean;
}

/**
 * Type for a cart entity in Ecommerce
 */
export interface Cart {
  /**
   * The unique ID representing this cart
   */
  cart_id?: string;
  /**
   * The total value of the cart after this interaction
   */
  total_value: number;
  /**
   * The currency used for this cart (ISO 4217)
   */
  currency: string;
  /**
   * Array of products added/removed from cart
   */
  products?: Product[];
}

/**
 * Type/Schema for a page entity in Ecommerce
 */
export interface Page {
  /**
   * The type of the page that was visited (e.g. homepage, product page, cart,checkout page, etc)
   */
  type: string;
  /**
   * The language that the web page is based in
   */
  language?: string;
  /**
   * The locale version of the site that is running
   */
  locale?: string;
}

/**
 * Type/Schema for a product entity in Ecommerce
 */
export type Product = {
  /**
   * The product ID
   */
  product_id?: string;

  /**
   * The variant ID
   */
  variant_id?: string;

  /**
   * The name or title of the product
   */
  name?: string;
  /**
   * The category the product belongs to.
   * Use a consistent separator to express multiple levels. E.g. Woman/Shoes/Sneakers
   */
  category?: string;
  /**
   * The price of the product at the current time.
   */
  price?: number;
  /**
   * The recommended or list price of a product
   */
  list_price?: number;
  /**
   * The quantity of the product taking part in the action. Used for Cart events.
   */
  quantity?: number;
  /**
   * The size of the product
   */
  size?: string;
  /**
   * The variant of the product
   */
  variant?: string;
  /**
   * The brand of the product
   */
  brand?: string;
  /**
   * The inventory status of the product (e.g. in stock, out of stock, preorder, backorder, etc)
   */
  inventory_status?: string;
  /**
   * The position the product was presented in a list of products (search results, product list page, etc)
   */
  position?: number;
  /**
   * The currency in which the product is being priced (ISO 4217)
   */
  currency?: string;
  /**
   * Identifier/Name/Url for the creative presented on a list or product view.
   */
  creative_id?: string;
};

/**
 * Type/Schema for a search entity in Ecommerce
 */
export type Search = {
  /**
   * The searched query.
   */
  query: string;
  /**
   * The number of results returned by the search.
   */
  results_count?: number;
  /**
   * Array of products returned by the search.
   */
  resultProducts?: Product[];
};

/**
 * Type/Schema for a transaction entity in Ecommerce
 */
export interface Transaction {
  /**
   * The ID of the transaction
   */
  transaction_id: string;
  /**
   * The total value of the transaction
   */
  revenue: number;
  /**
   * The currency used for the transaction
   */
  currency: string;
  /**
   * The payment method used for the transaction
   */
  payment_method?: string;
  /**
   * Total quantity of items in the transaction
   */
  total_quantity?: number;
  /**
   * Discount amount taken off
   */
  discount_amount?: number;
  /**
   * Whether the transaction is a credit order or not
   */
  credit_order?: boolean;
  /**
   * Array of products on the transaction from cart
   */
  products?: Product[];
}

/**
 * Type/Schema for a refund entity in Ecommerce
 */
export interface Refund {
  /**
   * The ID of the transaction.
   */
  transaction_id: string;
  /**
   * The currency in which the product is being priced (ISO 4217).
   */
  currency: string;
  /**
   * The monetary amount refunded.
   */
  refund_amount: number;
  /**
   * Reason for refunding the whole or part of the transaction.
   */
  refund_reason?: string | null;
  /**
   * Array of products on the refund. This is used when specific products are refunded.
   * If not present, the whole transaction and products will be marked as refunded.
   */
  products?: Product[];
}

/**
 * Type/Schema for an user entity in Ecommerce
 */
export interface User {
  /**
   * The user ID
   */
  id: string;
  /**
   * Whether or not the user is a guest
   */
  is_guest?: boolean;
  /**
   * The user's email address
   */
  email?: string;
}

export interface CommonEcommerceEventProperties<T = Record<string, unknown>> extends CommonEventProperties<T> {
  /** Add context to an event by setting an Array of Self Describing JSON */
  context?: Exclude<CommonEventProperties<T>['context'], null>;
}

export type ListViewEvent = { name: string; products: Product[] };

export type ListClickEvent = { productList: string, product: Product }

export enum PageType {
  // Product List Page / collection page
  PLP = 'plp',
  // Product Detail Page
  PDP = 'pdp',
}

export interface DwellAction {
  type: PageType;

  // duration in ms
  duration: number;
}

export interface ProductDwell {
  product: Product;

  // duration in ms
  duration: number;

  pageType: PageType;
}
