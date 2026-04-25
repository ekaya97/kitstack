export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: Record<string, string>;
  };
  data: {
    id: string;
    attributes: {
      status: string;
      total: number;
      currency: string;
      user_email: string;
      first_order_item: {
        product_id: number;
        variant_id: number;
      };
    };
  };
}
