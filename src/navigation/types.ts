/**
 * Dokan App – Navigation Type Definitions
 * All screen param types for type-safe navigation.
 */
import { NavigatorScreenParams } from '@react-navigation/native';

// ─── Auth Stack ────────────────────────────────────────────────────────────
export type AuthStackParamList = {
  Login: { redirect?: string } | undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// ─── Main Tab Navigator ────────────────────────────────────────────────────
export type MainTabParamList = {
  Home: undefined;
  Categories: undefined;
  Cart: undefined;
  Wishlist: undefined;
  Account: undefined;
};

// ─── Home Stack ────────────────────────────────────────────────────────────
export type HomeStackParamList = {
  HomeScreen: undefined;
  ProductDetail: { productId: number; productName?: string };
  SubcategoryList: { categoryId: number; categoryName: string };
  ProductList: {
    categoryId?: number;
    categoryName?: string;
    title?: string;
    filter?: 'featured' | 'sale' | 'best_sellers' | 'latest';
  };
  Search: { initialQuery?: string } | undefined;
};

// ─── Categories Stack ──────────────────────────────────────────────────────
export type CategoriesStackParamList = {
  CategoriesScreen: undefined;
  SubcategoryList: { categoryId: number; categoryName: string };
  ProductList: {
    categoryId: number;
    categoryName: string;
  };
  ProductDetail: { productId: number; productName?: string };
};

// ─── Cart Stack ────────────────────────────────────────────────────────────
export type CartStackParamList = {
  CartScreen: undefined;
  Checkout: undefined;
  OrderSuccess: { orderId?: number; orderNumber?: string };
};

// ─── Wishlist Stack ────────────────────────────────────────────────────────
export type WishlistStackParamList = {
  WishlistScreen: undefined;
};

// ─── Account Stack ─────────────────────────────────────────────────────────
export type AccountStackParamList = {
  AccountScreen: undefined;
  Orders: undefined;
  OrderDetail: { orderId: number; orderKey?: string };
  EditProfile: undefined;
  Addresses: undefined;
  EditAddress: { type: 'billing' | 'shipping' };
  Notifications: undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
  ContactUs: undefined;
};

// ─── Root Navigator ────────────────────────────────────────────────────────
export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Type-safe navigation helper
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
