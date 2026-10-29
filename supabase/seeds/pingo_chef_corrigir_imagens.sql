-- Corrige somente as fotos dos itens criados pelo seed PingoChef, sem reinserir produtos.
-- Executar inteiro no SQL Editor do Supabase. Reexecutar não duplica nem regrava fotos iguais.
-- Fotos ilustrativas CC0/domínio público; fontes em pingo_chef_imagens.json.
-- Não altera nomes, preços, descrições, categorias, design, plano, vídeos ou publicação.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';
CREATE TEMP TABLE _pingo_photos (category_key text NOT NULL, name text NOT NULL, image_url text NOT NULL UNIQUE,
  PRIMARY KEY(category_key,name)) ON COMMIT DROP;
INSERT INTO _pingo_photos (category_key, name, image_url) VALUES
 ('burgers', 'Pingo Cheese', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Cheeseburger.jpg/960px-Cheeseburger.jpg'),
 ('burgers', 'Pingo Salada', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b2/Cheeseburger_with_lettuce.jpg/960px-Cheeseburger_with_lettuce.jpg'),
 ('burgers', 'Pingo Bacon', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Burger-King-Bacon-Cheeseburger.jpg/960px-Burger-King-Bacon-Cheeseburger.jpg'),
 ('burgers', 'Pingo Cheddar & Cebola', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Hamburger_%288%29.jpg/960px-Hamburger_%288%29.jpg'),
 ('burgers', 'Pingo Duplo Clássico', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Cheeseburger_and_mac_and_cheese.jpg/960px-Cheeseburger_and_mac_and_cheese.jpg'),
 ('burgers', 'Smash Pingo Simples', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Cheeseburger_2.jpg/960px-Cheeseburger_2.jpg'),
 ('burgers', 'Smash Pingo Duplo', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Burger_King_double_cheeseburger.jpg/960px-Burger_King_double_cheeseburger.jpg'),
 ('burgers', 'Smash Pingo Triplo', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Humongous_Austrian_Burger_With_Bacon_and_French_Fries.jpg/960px-Humongous_Austrian_Burger_With_Bacon_and_French_Fries.jpg'),
 ('burgers', 'Smash Bacon Crunch', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Klompus_Burger_With_Bacon%2C_Cheese_and_French_Fries.jpg/960px-Klompus_Burger_With_Bacon%2C_Cheese_and_French_Fries.jpg'),
 ('burgers', 'Pingo Chef Signature', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Hamburger_%28black_bg%29.jpg/960px-Hamburger_%28black_bg%29.jpg'),
 ('burgers', 'Pingo Picante', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Hamburger_tasty.jpg/960px-Hamburger_tasty.jpg'),
 ('burgers', 'Pingo BBQ Onion', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Moshbutz_Burger_With_Bacon_and_Potatoes.jpg/960px-Moshbutz_Burger_With_Bacon_and_Potatoes.jpg'),
 ('burgers', 'Pingo Quatro Queijos', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/Cheeseburger_maison.jpg/960px-Cheeseburger_maison.jpg'),
 ('alternativas', 'Pingo Chicken Crispy', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Chicken_Sandwich_-_Popeyes%2C_Brighton.jpg/960px-Chicken_Sandwich_-_Popeyes%2C_Brighton.jpg'),
 ('alternativas', 'Pingo Chicken BBQ', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Hot_Honey_Sandwich_-_Popeyes_2025-08-17.jpg/960px-Hot_Honey_Sandwich_-_Popeyes_2025-08-17.jpg'),
 ('alternativas', 'Pingo Chicken Grelhado', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/Broiled_chicken_breast_and_tomato_sandwich%2C_on_mixed_rye-white_toast%2C_with_mustard_and_black_pepper_-_Massachusetts.jpg/960px-Broiled_chicken_breast_and_tomato_sandwich%2C_on_mixed_rye-white_toast%2C_with_mustard_and_black_pepper_-_Massachusetts.jpg'),
 ('alternativas', 'Pingo Veggie Grão-de-bico', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Veggie_burger_on_plate_%28Unsplash%29.jpg/960px-Veggie_burger_on_plate_%28Unsplash%29.jpg'),
 ('alternativas', 'Pingo Portobello', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Mushroom_vegetarian_burger_-_Grubbs.jpg/960px-Mushroom_vegetarian_burger_-_Grubbs.jpg'),
 ('combos', 'Combo Pingo Cheese', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d0/Burger_and_fries_2.jpg/960px-Burger_and_fries_2.jpg'),
 ('combos', 'Combo Smash Duplo', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Cheeseburger_and_fries_4.jpg/960px-Cheeseburger_and_fries_4.jpg'),
 ('combos', 'Combo Chicken Crispy', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/KFC_Chicken_sandwich_-_October_2024_-_Sarah_Stierch.jpg/960px-KFC_Chicken_sandwich_-_October_2024_-_Sarah_Stierch.jpg'),
 ('combos', 'Combo Veggie', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Fancy_Veggie_Burger_and_Fries_-_Joe%27s_Burger_House_2024-07-07.jpg/960px-Fancy_Veggie_Burger_and_Fries_-_Joe%27s_Burger_House_2024-07-07.jpg'),
 ('combos', 'Combo Dupla Pingo', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d9/Burger_and_fries_%281%29.jpg/960px-Burger_and_fries_%281%29.jpg'),
 ('combos', 'Combo Família Pingo', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/Klompus_Burger_and_French_Fries.jpg/960px-Klompus_Burger_and_French_Fries.jpg'),
 ('porcoes', 'Batata Frita Individual 120 g', 'https://upload.wikimedia.org/wikipedia/commons/8/83/French_Fries.JPG'),
 ('porcoes', 'Batata Frita para Compartilhar 300 g', 'https://upload.wikimedia.org/wikipedia/commons/2/2f/French_fries_and_spices.jpg'),
 ('porcoes', 'Batata Cheddar & Bacon 350 g', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Loaded_fries_food.jpg/960px-Loaded_fries_food.jpg'),
 ('porcoes', 'Batata Rústica da Casa 300 g', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Bat_Yaar_French_Fries.jpg/960px-Bat_Yaar_French_Fries.jpg'),
 ('porcoes', 'Onion Rings 12 Unidades', 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Onion_rings_fried.jpg'),
 ('porcoes', 'Nuggets de Frango 10 Unidades', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Chicken_nuggets_on_a_plate.jpg/960px-Chicken_nuggets_on_a_plate.jpg'),
 ('porcoes', 'Iscas de Frango Crocantes 300 g', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Fried_chicken_strips_sitting_on_baking_rack.jpg/960px-Fried_chicken_strips_sitting_on_baking_rack.jpg'),
 ('bebidas', 'Refrigerante Cola 350 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Coca-Cola_can_with_Khmer_equivalent.jpg/960px-Coca-Cola_can_with_Khmer_equivalent.jpg'),
 ('bebidas', 'Refrigerante Cola Zero 350 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Coca_Cola_zero_%28lattina%29.JPG/960px-Coca_Cola_zero_%28lattina%29.JPG'),
 ('bebidas', 'Refrigerante Cola 2 Litros', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Coca-Cola_bottle_Shenzhen_China.jpeg/960px-Coca-Cola_bottle_Shenzhen_China.jpeg'),
 ('bebidas', 'Água Mineral sem Gás 500 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/InterContinental_Yokohama_Grand_bottled_water_20111101.jpg/960px-InterContinental_Yokohama_Grand_bottled_water_20111101.jpg'),
 ('bebidas', 'Água Mineral com Gás 500 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Zabarvan_water_bottle.jpg/960px-Zabarvan_water_bottle.jpg'),
 ('bebidas', 'Suco de Laranja 300 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Orange_juice_3.jpg/960px-Orange_juice_3.jpg'),
 ('bebidas', 'Suco de Limão 300 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Lemonade_mason_jar.jpg/960px-Lemonade_mason_jar.jpg'),
 ('bebidas', 'Chopp Pilsen 300 ml', 'https://upload.wikimedia.org/wikipedia/commons/5/50/Beer_glass_%281%29.jpg'),
 ('bebidas', 'Cerveja Lager Long Neck 330 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Angkor_beer_bottle_%26_glass.jpg/960px-Angkor_beer_bottle_%26_glass.jpg'),
 ('shakes', 'Milk-shake de Chocolate 400 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Chocolate_milk_shake_-_The_Bystander_Cafe.jpg/960px-Chocolate_milk_shake_-_The_Bystander_Cafe.jpg'),
 ('shakes', 'Milk-shake de Morango 400 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Milkshake_beverage_strawberry_drink-1021027.jpg/960px-Milkshake_beverage_strawberry_drink-1021027.jpg'),
 ('shakes', 'Milk-shake de Baunilha 400 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Five_Guys_Milkshake.jpg/960px-Five_Guys_Milkshake.jpg'),
 ('shakes', 'Milk-shake Cookies 400 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Oreo_milkshake_-_Creperie_Doux_Sourire_2025-05-03.jpg/960px-Oreo_milkshake_-_Creperie_Doux_Sourire_2025-05-03.jpg'),
 ('shakes', 'Milk-shake Doce de Leite 400 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Salted_Caramel_Milkshake.jpg/960px-Salted_Caramel_Milkshake.jpg'),
 ('shakes', 'Milk-shake Paçoca 400 ml', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/Fat_Annie%27s_Crunchie_Shake.jpg/960px-Fat_Annie%27s_Crunchie_Shake.jpg'),
 ('sobremesas', 'Brownie Pingo Chocolate', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Oreo_brownie_-_Cafe_Coho_2024-05-30.jpg/960px-Oreo_brownie_-_Cafe_Coho_2024-05-30.jpg'),
 ('sobremesas', 'Cookie Recheado de Chocolate', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Choc-Chip-Cookie.jpg/960px-Choc-Chip-Cookie.jpg'),
 ('sobremesas', 'Churros com Doce de Leite 6 Unidades', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Churros_001.jpg/960px-Churros_001.jpg'),
 ('sobremesas', 'Brownie com Sorvete Pingo', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d9/Deflour_rhum_chocolate_cake_and_vanilla_ice_cream.JPG/960px-Deflour_rhum_chocolate_cake_and_vanilla_ice_cream.JPG'),
 ('sobremesas', 'Sorvete Duas Bolas', 'https://pixnio.com/free-images/2017/08/16/2017-08-16-07-55-38-576x384.jpg'),
 ('extras', 'Maionese da Casa 30 g', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Mayonnaise.JPG/960px-Mayonnaise.JPG'),
 ('extras', 'Barbecue 30 g', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/Hunts-Barbecue-Sauce.jpg/960px-Hunts-Barbecue-Sauce.jpg'),
 ('extras', 'Maionese de Alho Assado 30 g', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bf/Toum_%28Lebanese_Garlic_Sauce%29.JPG/960px-Toum_%28Lebanese_Garlic_Sauce%29.JPG'),
 ('extras', 'Molho de Pimenta 30 g', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/Haut_Ones_sauces_piquantes.jpg/120px-Haut_Ones_sauces_piquantes.jpg'),
 ('extras', 'Bacon Extra 30 g', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Bacon_%281%29.jpg/960px-Bacon_%281%29.jpg'),
 ('extras', 'Cheddar Extra 40 g', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Sauchef_Cheddar_Cheese_Sauce.jpg/960px-Sauchef_Cheddar_Cheese_Sauce.jpg'),
 ('extras', 'Burger Bovino Extra 80 g', 'https://upload.wikimedia.org/wikipedia/commons/5/52/Hamburger_patty.jpg');
CREATE TEMP TABLE _pingo_photo_result (produtos_encontrados integer, imagens_atualizadas integer) ON COMMIT DROP;
DO $photos$
DECLARE v_business uuid; v_found integer; v_updated integer;
BEGIN
  SELECT b.id INTO v_business FROM public.businesses b JOIN auth.users u ON u.id = b.owner_user_id
  WHERE b.id = 'abb14fb8-847b-4bb3-afef-1f4a3fd73f33'::uuid
    AND b.owner_user_id = '86776e6b-7ebb-4cbe-8b3a-1a9cc4359ca1'::uuid
    AND lower(u.email) = 'alexandre45648@gmail.com';
  IF v_business IS NULL THEN RAISE EXCEPTION 'Conta PingoChef não encontrada com os identificadores esperados.'; END IF;
  PERFORM public.lock_business_capacity(v_business);
  SELECT count(*) INTO v_found FROM public.menu_items i JOIN _pingo_photos p
    ON i.id = md5(v_business::text || ':pingo-demo-v1:item:' || p.category_key || ':' || p.name)::uuid
    AND i.business_id = v_business AND i.name = p.name;
  IF v_found = 0 THEN RAISE EXCEPTION 'Nenhum produto do seed foi encontrado. Execute primeiro o seed completo nesta conta.'; END IF;
  UPDATE public.menu_items i SET image_url = p.image_url, updated_at = now() FROM _pingo_photos p
  WHERE i.id = md5(v_business::text || ':pingo-demo-v1:item:' || p.category_key || ':' || p.name)::uuid
    AND i.business_id = v_business AND i.name = p.name AND i.image_url IS DISTINCT FROM p.image_url;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  INSERT INTO _pingo_photo_result VALUES (v_found, v_updated);
END;
$photos$;
SELECT * FROM _pingo_photo_result;
COMMIT;
