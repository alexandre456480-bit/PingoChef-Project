import { getItemsController } from "../controllers/item.controller";
import { createUserClient, supabaseAdmin } from "../config/supabase";
import { SupabaseProductMediaRepository } from "../repositories/product-media.repository";

jest.mock("../config/supabase", () => ({
  isSupabaseConfigured: true,
  createUserClient: jest.fn(),
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn() },
}));
jest.mock("../repositories/product-media.repository", () => ({
  SupabaseProductMediaRepository: jest
    .fn()
    .mockImplementation(() => ({
      listGalleryMedia: jest.fn().mockResolvedValue([]),
    })),
}));

it("uses the tenant category FK while retaining owner RLS and server business scope", async () => {
  const gallery = jest.fn().mockResolvedValue([]);
  (SupabaseProductMediaRepository as jest.Mock).mockImplementation(() => ({
    listGalleryMedia: gallery,
  }));
  const query: any = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue({
    data: [
      {
        id: "item",
        name: "Produto",
        price: "12.50",
        category_id: "category",
        categories: { name: "Categoria" },
      },
    ],
    error: null,
  });
  const from = jest.fn().mockReturnValue(query);
  (createUserClient as jest.Mock).mockReturnValue({ from });
  const res: any = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  const next = jest.fn();
  await getItemsController(
    {
      businessId: "owner-business",
      accessToken: "test-owner-token",
      query: { businessId: "other-business" },
    } as any,
    res,
    next,
  );
  expect(createUserClient).toHaveBeenCalledWith("test-owner-token");
  expect(from).toHaveBeenCalledWith("menu_items");
  expect(query.select).toHaveBeenCalledWith(
    expect.stringContaining("categories!menu_items_category_tenant_fk(name)"),
  );
  expect(query.select.mock.calls[0][0]).not.toContain('*');
  expect(query.eq).toHaveBeenCalledWith("business_id", "owner-business");
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
  expect(gallery).toHaveBeenCalledWith("owner-business", ["item"], false);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    data: [
      expect.objectContaining({
        id: "item",
        categoryName: "Categoria",
        price: 12.5,
        media: [],
      }),
    ],
  });
  expect(next).not.toHaveBeenCalled();
});
