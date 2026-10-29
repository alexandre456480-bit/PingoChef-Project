-- PingoChef: catálogo demonstrativo para alexandre45648@gmail.com.
-- Executar completo no SQL Editor do Supabase, com a conexão administrativa.
-- Não é migration. Não publica o cardápio nem altera plano, design ou vídeos.
-- Reexecução preserva registros existentes com o mesmo nome na mesma categoria.
-- Preços, receitas e fotos são ilustrativos; 58 fotos distintas de bancos de imagens.
-- Fontes/licenças: pingo_chef_imagens.json. Dois itens sem foto compatível mantêm NULL.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE _pingo_target (business_id uuid PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE _pingo_categories (
  key text PRIMARY KEY, name text NOT NULL, description text NOT NULL,
  icon_key text NOT NULL, position integer NOT NULL, id uuid, is_new boolean
) ON COMMIT DROP;
INSERT INTO _pingo_categories (key, name, description, icon_key, position) VALUES
 ('burgers', 'Hambúrgueres Artesanais', 'Burgers na chapa, pães macios e combinações preparadas na hora.', '2d-pixel-burger', 1),
 ('alternativas', 'Frango & Vegetarianos', 'Frango crocante ou grelhado e receitas vegetarianas cheias de sabor.', '2d-pixel-chef', 2),
 ('combos', 'Combos PingoChef', 'Burgers, acompanhamentos e bebidas em combinações individuais ou para compartilhar.', '2d-pixel-star', 3),
 ('porcoes', 'Porções & Acompanhamentos', 'Batatas, anéis de cebola e petiscos para completar o pedido.', '2d-pixel-fries', 4),
 ('bebidas', 'Bebidas & Chopp', 'Refrigerantes, sucos e bebidas geladas. Bebidas alcoólicas somente para maiores de 18 anos.', '2d-pixel-drink', 5),
 ('shakes', 'Milk-shakes', 'Milk-shakes cremosos de 400 ml, dos clássicos às combinações especiais.', '2d-pixel-icecream', 6),
 ('sobremesas', 'Sobremesas', 'Doces e sobremesas geladas para terminar o pedido.', '2d-pixel-heart', 7),
 ('extras', 'Molhos & Adicionais', 'Molhos em potes separados e ingredientes extras vendidos à parte.', '2d-pixel-fire', 8);

CREATE TEMP TABLE _pingo_subcategories (
  category_key text NOT NULL REFERENCES _pingo_categories(key), name text NOT NULL,
  position integer NOT NULL, id uuid, is_new boolean, PRIMARY KEY (category_key, name)
) ON COMMIT DROP;
INSERT INTO _pingo_subcategories (category_key, name, position) VALUES
 ('burgers', 'Artesanais Clássicos', 1), ('burgers', 'Smash Burgers', 2), ('burgers', 'Especiais da Casa', 3),
 ('alternativas', 'Burgers de Frango', 1), ('alternativas', 'Vegetarianos', 2),
 ('combos', 'Combos Individuais', 1), ('combos', 'Para Compartilhar', 2),
 ('porcoes', 'Batatas', 1), ('porcoes', 'Petiscos', 2),
 ('bebidas', 'Sucos & Refrigerantes', 1), ('bebidas', 'Chopps & Cervejas', 2),
 ('shakes', 'Clássicos', 1), ('shakes', 'Especiais', 2),
 ('sobremesas', 'Doces da Casa', 1), ('sobremesas', 'Gelados', 2),
 ('extras', 'Molhos da Casa', 1), ('extras', 'Ingredientes Extras', 2);

CREATE TEMP TABLE _pingo_items (
  position bigint GENERATED ALWAYS AS IDENTITY,
  category_key text NOT NULL, subcategory_name text NOT NULL, name text NOT NULL,
  description text NOT NULL, price numeric(10,2) NOT NULL CHECK (price >= 0),
  promotional_price numeric(10,2) CHECK (promotional_price >= 0 AND promotional_price < price),
  highlight_type text NOT NULL CHECK (highlight_type IN ('none','promotion','most_liked','chef','combo','best_seller')),
  image_url text,
  FOREIGN KEY (category_key, subcategory_name) REFERENCES _pingo_subcategories(category_key, name),
  UNIQUE (category_key, name)
) ON COMMIT DROP;
INSERT INTO _pingo_items (category_key, subcategory_name, name, description, price, promotional_price, highlight_type, image_url) VALUES
 ('burgers','Artesanais Clássicos','Pingo Cheese','Pão brioche tostado, burger bovino de 160 g, queijo cheddar, picles e maionese da casa.',24.90,NULL,'best_seller','https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Cheeseburger.jpg/960px-Cheeseburger.jpg'),
 ('burgers','Artesanais Clássicos','Pingo Salada','Pão brioche, burger bovino de 160 g, queijo prato, alface, tomate e maionese da casa.',27.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b2/Cheeseburger_with_lettuce.jpg/960px-Cheeseburger_with_lettuce.jpg'),
 ('burgers','Artesanais Clássicos','Pingo Bacon','Pão brioche, burger bovino de 180 g, cheddar, bacon crocante e molho defumado.',32.90,29.90,'promotion','https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Burger-King-Bacon-Cheeseburger.jpg/960px-Burger-King-Bacon-Cheeseburger.jpg'),
 ('burgers','Artesanais Clássicos','Pingo Cheddar & Cebola','Burger bovino de 180 g, cheddar cremoso, cebola caramelizada e maionese no pão australiano.',33.90,NULL,'most_liked','https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Hamburger_%288%29.jpg/960px-Hamburger_%288%29.jpg'),
 ('burgers','Artesanais Clássicos','Pingo Duplo Clássico','Dois burgers bovinos de 160 g, queijo prato em dobro, picles e molho da casa no pão brioche.',39.90,NULL,'best_seller','https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Cheeseburger_and_mac_and_cheese.jpg/960px-Cheeseburger_and_mac_and_cheese.jpg'),
 ('burgers','Smash Burgers','Smash Pingo Simples','Pão macio, smash bovino de 80 g com crosta na chapa, cheddar, picles e molho especial.',19.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Cheeseburger_2.jpg/960px-Cheeseburger_2.jpg'),
 ('burgers','Smash Burgers','Smash Pingo Duplo','Dois smash burgers de 80 g, duas fatias de cheddar, cebola roxa, picles e molho especial.',27.90,24.90,'promotion','https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Burger_King_double_cheeseburger.jpg/960px-Burger_King_double_cheeseburger.jpg'),
 ('burgers','Smash Burgers','Smash Pingo Triplo','Três smash burgers de 80 g, cheddar em camadas e cebola caramelizada no pão brioche.',35.90,NULL,'most_liked','https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Humongous_Austrian_Burger_With_Bacon_and_French_Fries.jpg/960px-Humongous_Austrian_Burger_With_Bacon_and_French_Fries.jpg'),
 ('burgers','Smash Burgers','Smash Bacon Crunch','Dois smash burgers de 80 g, cheddar, bacon crocante, cebola crispy e barbecue.',32.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Klompus_Burger_With_Bacon%2C_Cheese_and_French_Fries.jpg/960px-Klompus_Burger_With_Bacon%2C_Cheese_and_French_Fries.jpg'),
 ('burgers','Especiais da Casa','Pingo Chef Signature','Pão brioche, burger bovino de 200 g, queijo meia cura, bacon, cebola caramelizada e maionese de alho assado.',42.90,NULL,'chef','https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Hamburger_%28black_bg%29.jpg/960px-Hamburger_%28black_bg%29.jpg'),
 ('burgers','Especiais da Casa','Pingo Picante','Burger bovino de 180 g, cheddar, jalapeño, cebola roxa e maionese de pimenta. Picância média.',36.90,NULL,'chef','https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Hamburger_tasty.jpg/960px-Hamburger_tasty.jpg'),
 ('burgers','Especiais da Casa','Pingo BBQ Onion','Burger bovino de 180 g, queijo prato, anéis de cebola, bacon e barbecue no pão australiano.',38.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Moshbutz_Burger_With_Bacon_and_Potatoes.jpg/960px-Moshbutz_Burger_With_Bacon_and_Potatoes.jpg'),
 ('burgers','Especiais da Casa','Pingo Quatro Queijos','Burger bovino de 180 g com cheddar, muçarela, queijo prato, creme de gorgonzola e maionese da casa.',39.90,NULL,'chef','https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/Cheeseburger_maison.jpg/960px-Cheeseburger_maison.jpg'),
 ('alternativas','Burgers de Frango','Pingo Chicken Crispy','Filé de frango empanado, queijo prato, alface, tomate e maionese de limão no pão brioche.',29.90,NULL,'best_seller','https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Chicken_Sandwich_-_Popeyes%2C_Brighton.jpg/960px-Chicken_Sandwich_-_Popeyes%2C_Brighton.jpg'),
 ('alternativas','Burgers de Frango','Pingo Chicken BBQ','Frango empanado crocante, cheddar, bacon e barbecue no pão macio.',33.90,30.90,'promotion','https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Hot_Honey_Sandwich_-_Popeyes_2025-08-17.jpg/960px-Hot_Honey_Sandwich_-_Popeyes_2025-08-17.jpg'),
 ('alternativas','Burgers de Frango','Pingo Chicken Grelhado','Filé de frango grelhado, queijo branco, alface, tomate e molho de iogurte no pão integral.',30.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/Broiled_chicken_breast_and_tomato_sandwich%2C_on_mixed_rye-white_toast%2C_with_mustard_and_black_pepper_-_Massachusetts.jpg/960px-Broiled_chicken_breast_and_tomato_sandwich%2C_on_mixed_rye-white_toast%2C_with_mustard_and_black_pepper_-_Massachusetts.jpg'),
 ('alternativas','Vegetarianos','Pingo Veggie Grão-de-bico','Burger de grão-de-bico, queijo prato, alface, tomate e maionese de ervas. Receita vegetariana, contém leite e ovos.',31.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Veggie_burger_on_plate_%28Unsplash%29.jpg/960px-Veggie_burger_on_plate_%28Unsplash%29.jpg'),
 ('alternativas','Vegetarianos','Pingo Portobello','Cogumelo portobello grelhado, queijo meia cura, rúcula, cebola caramelizada e maionese no brioche. Vegetariano.',35.90,NULL,'chef','https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Mushroom_vegetarian_burger_-_Grubbs.jpg/960px-Mushroom_vegetarian_burger_-_Grubbs.jpg'),
 ('combos','Combos Individuais','Combo Pingo Cheese','Um Pingo Cheese, batata frita individual de 120 g e refrigerante em lata de 350 ml, conforme disponibilidade da casa.',37.90,34.90,'combo','https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d0/Burger_and_fries_2.jpg/960px-Burger_and_fries_2.jpg'),
 ('combos','Combos Individuais','Combo Smash Duplo','Um Smash Pingo Duplo, batata frita de 120 g e refrigerante em lata de 350 ml.',42.90,NULL,'combo','https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Cheeseburger_and_fries_4.jpg/960px-Cheeseburger_and_fries_4.jpg'),
 ('combos','Combos Individuais','Combo Chicken Crispy','Um Pingo Chicken Crispy, batata frita de 120 g e refrigerante em lata de 350 ml.',44.90,NULL,'combo','https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/KFC_Chicken_sandwich_-_October_2024_-_Sarah_Stierch.jpg/960px-KFC_Chicken_sandwich_-_October_2024_-_Sarah_Stierch.jpg'),
 ('combos','Combos Individuais','Combo Veggie','Um Pingo Veggie Grão-de-bico, batata rústica de 120 g e suco de laranja de 300 ml. Contém leite e ovos.',46.90,NULL,'combo','https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Fancy_Veggie_Burger_and_Fries_-_Joe%27s_Burger_House_2024-07-07.jpg/960px-Fancy_Veggie_Burger_and_Fries_-_Joe%27s_Burger_House_2024-07-07.jpg'),
 ('combos','Para Compartilhar','Combo Dupla Pingo','Dois Pingo Cheese, uma batata frita de 300 g e dois refrigerantes em lata de 350 ml.',72.90,66.90,'combo','https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d9/Burger_and_fries_%281%29.jpg/960px-Burger_and_fries_%281%29.jpg'),
 ('combos','Para Compartilhar','Combo Família Pingo','Quatro Smash Pingo Simples, uma batata frita de 500 g e um refrigerante de 2 litros. Serve até quatro pessoas.',119.90,NULL,'combo','https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/Klompus_Burger_and_French_Fries.jpg/960px-Klompus_Burger_and_French_Fries.jpg'),
 ('porcoes','Batatas','Batata Frita Individual 120 g','Batatas fritas crocantes, sal na medida e um pote de ketchup de 30 g.',11.90,NULL,'none','https://upload.wikimedia.org/wikipedia/commons/8/83/French_Fries.JPG'),
 ('porcoes','Batatas','Batata Frita para Compartilhar 300 g','Porção de batatas fritas de 300 g com ketchup e maionese da casa em potes separados.',22.90,NULL,'none','https://upload.wikimedia.org/wikipedia/commons/2/2f/French_fries_and_spices.jpg'),
 ('porcoes','Batatas','Batata Cheddar & Bacon 350 g','Batatas fritas cobertas com cheddar cremoso e bacon crocante. Porção total aproximada de 350 g.',29.90,26.90,'promotion','https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Loaded_fries_food.jpg/960px-Loaded_fries_food.jpg'),
 ('porcoes','Batatas','Batata Rústica da Casa 300 g','Batatas com casca, alecrim e páprica, acompanhadas de maionese de alho assado.',25.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Bat_Yaar_French_Fries.jpg/960px-Bat_Yaar_French_Fries.jpg'),
 ('porcoes','Petiscos','Onion Rings 12 Unidades','Doze anéis de cebola empanados e crocantes, acompanhados de barbecue.',23.90,NULL,'none','https://upload.wikimedia.org/wikipedia/commons/c/cd/Onion_rings_fried.jpg'),
 ('porcoes','Petiscos','Nuggets de Frango 10 Unidades','Dez nuggets de frango com ketchup e maionese da casa em potes separados.',21.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Chicken_nuggets_on_a_plate.jpg/960px-Chicken_nuggets_on_a_plate.jpg'),
 ('porcoes','Petiscos','Iscas de Frango Crocantes 300 g','Iscas de frango empanadas, porção de 300 g, com molho de mostarda e mel.',32.90,NULL,'most_liked','https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Fried_chicken_strips_sitting_on_baking_rack.jpg/960px-Fried_chicken_strips_sitting_on_baking_rack.jpg'),
 ('porcoes','Petiscos','Dadinho de Tapioca 12 Unidades','Doze dadinhos de tapioca com queijo coalho, acompanhados de geleia de pimenta.',27.90,NULL,'chef',NULL),
 ('bebidas','Sucos & Refrigerantes','Refrigerante Cola 350 ml','Refrigerante de cola em lata de 350 ml, servido gelado.',7.00,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Coca-Cola_can_with_Khmer_equivalent.jpg/960px-Coca-Cola_can_with_Khmer_equivalent.jpg'),
 ('bebidas','Sucos & Refrigerantes','Refrigerante Cola Zero 350 ml','Refrigerante de cola sem açúcar em lata de 350 ml, servido gelado.',7.00,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Coca_Cola_zero_%28lattina%29.JPG/960px-Coca_Cola_zero_%28lattina%29.JPG'),
 ('bebidas','Sucos & Refrigerantes','Refrigerante Guaraná 350 ml','Refrigerante de guaraná em lata de 350 ml, servido gelado.',7.00,NULL,'none',NULL),
 ('bebidas','Sucos & Refrigerantes','Refrigerante Cola 2 Litros','Garrafa de refrigerante de cola de 2 litros para compartilhar.',15.00,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Coca-Cola_bottle_Shenzhen_China.jpeg/960px-Coca-Cola_bottle_Shenzhen_China.jpeg'),
 ('bebidas','Sucos & Refrigerantes','Água Mineral sem Gás 500 ml','Água mineral sem gás em garrafa de 500 ml.',5.00,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/InterContinental_Yokohama_Grand_bottled_water_20111101.jpg/960px-InterContinental_Yokohama_Grand_bottled_water_20111101.jpg'),
 ('bebidas','Sucos & Refrigerantes','Água Mineral com Gás 500 ml','Água mineral com gás em garrafa de 500 ml.',5.50,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Zabarvan_water_bottle.jpg/960px-Zabarvan_water_bottle.jpg'),
 ('bebidas','Sucos & Refrigerantes','Suco de Laranja 300 ml','Suco de laranja preparado na hora, sem adição de açúcar.',10.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Orange_juice_3.jpg/960px-Orange_juice_3.jpg'),
 ('bebidas','Sucos & Refrigerantes','Suco de Limão 300 ml','Suco de limão preparado na hora. Açúcar ou adoçante à parte.',9.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Lemonade_mason_jar.jpg/960px-Lemonade_mason_jar.jpg'),
 ('bebidas','Chopps & Cervejas','Chopp Pilsen 300 ml','Chopp pilsen de 300 ml, servido gelado. Produto alcoólico, venda somente para maiores de 18 anos.',12.90,NULL,'none','https://upload.wikimedia.org/wikipedia/commons/5/50/Beer_glass_%281%29.jpg'),
 ('bebidas','Chopps & Cervejas','Cerveja Lager Long Neck 330 ml','Cerveja lager em garrafa long neck de 330 ml. Produto alcoólico, venda somente para maiores de 18 anos.',12.00,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Angkor_beer_bottle_%26_glass.jpg/960px-Angkor_beer_bottle_%26_glass.jpg'),
 ('shakes','Clássicos','Milk-shake de Chocolate 400 ml','Sorvete batido com leite e calda de chocolate. Copo de 400 ml, contém leite.',19.90,NULL,'best_seller','https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Chocolate_milk_shake_-_The_Bystander_Cafe.jpg/960px-Chocolate_milk_shake_-_The_Bystander_Cafe.jpg'),
 ('shakes','Clássicos','Milk-shake de Morango 400 ml','Sorvete batido com leite e calda de morango. Copo de 400 ml, contém leite.',19.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Milkshake_beverage_strawberry_drink-1021027.jpg/960px-Milkshake_beverage_strawberry_drink-1021027.jpg'),
 ('shakes','Clássicos','Milk-shake de Baunilha 400 ml','Sorvete de baunilha batido com leite. Copo de 400 ml, contém leite.',18.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Five_Guys_Milkshake.jpg/960px-Five_Guys_Milkshake.jpg'),
 ('shakes','Especiais','Milk-shake Cookies 400 ml','Sorvete de baunilha, leite, biscoito de chocolate e calda de chocolate. Contém leite e glúten.',23.90,NULL,'most_liked','https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Oreo_milkshake_-_Creperie_Doux_Sourire_2025-05-03.jpg/960px-Oreo_milkshake_-_Creperie_Doux_Sourire_2025-05-03.jpg'),
 ('shakes','Especiais','Milk-shake Doce de Leite 400 ml','Sorvete batido com doce de leite e finalizado com calda de caramelo. Contém leite.',22.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Salted_Caramel_Milkshake.jpg/960px-Salted_Caramel_Milkshake.jpg'),
 ('shakes','Especiais','Milk-shake Paçoca 400 ml','Sorvete, leite, paçoca e calda de caramelo. Contém leite e amendoim.',22.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/Fat_Annie%27s_Crunchie_Shake.jpg/960px-Fat_Annie%27s_Crunchie_Shake.jpg'),
 ('sobremesas','Doces da Casa','Brownie Pingo Chocolate','Brownie de chocolate com casquinha fina e interior macio. Porção individual, contém leite, ovos e glúten.',13.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Oreo_brownie_-_Cafe_Coho_2024-05-30.jpg/960px-Oreo_brownie_-_Cafe_Coho_2024-05-30.jpg'),
 ('sobremesas','Doces da Casa','Cookie Recheado de Chocolate','Cookie grande com gotas de chocolate e recheio cremoso. Contém leite, ovos e glúten.',12.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Choc-Chip-Cookie.jpg/960px-Choc-Chip-Cookie.jpg'),
 ('sobremesas','Doces da Casa','Churros com Doce de Leite 6 Unidades','Seis mini churros com açúcar e canela, acompanhados de doce de leite. Contém leite e glúten.',17.90,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Churros_001.jpg/960px-Churros_001.jpg'),
 ('sobremesas','Gelados','Brownie com Sorvete Pingo','Brownie de chocolate aquecido, uma bola de sorvete de baunilha e calda de chocolate. Contém leite, ovos e glúten.',21.90,18.90,'promotion','https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d9/Deflour_rhum_chocolate_cake_and_vanilla_ice_cream.JPG/960px-Deflour_rhum_chocolate_cake_and_vanilla_ice_cream.JPG'),
 ('sobremesas','Gelados','Sorvete Duas Bolas','Duas bolas de sorvete de baunilha com calda de chocolate. Contém leite.',12.90,NULL,'none','https://pixnio.com/free-images/2017/08/16/2017-08-16-07-55-38-576x384.jpg'),
 ('extras','Molhos da Casa','Maionese da Casa 30 g','Pote de 30 g de maionese temperada, enviado separado. Contém ovos.',3.00,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Mayonnaise.JPG/960px-Mayonnaise.JPG'),
 ('extras','Molhos da Casa','Barbecue 30 g','Pote de 30 g de molho barbecue defumado, enviado separado.',3.50,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/Hunts-Barbecue-Sauce.jpg/960px-Hunts-Barbecue-Sauce.jpg'),
 ('extras','Molhos da Casa','Maionese de Alho Assado 30 g','Pote de 30 g de maionese com alho assado, enviado separado. Contém ovos.',3.50,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bf/Toum_%28Lebanese_Garlic_Sauce%29.JPG/960px-Toum_%28Lebanese_Garlic_Sauce%29.JPG'),
 ('extras','Molhos da Casa','Molho de Pimenta 30 g','Pote de 30 g de molho de pimenta da casa, enviado separado. Picância alta.',3.00,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/Haut_Ones_sauces_piquantes.jpg/120px-Haut_Ones_sauces_piquantes.jpg'),
 ('extras','Ingredientes Extras','Bacon Extra 30 g','Porção adicional de bacon crocante de 30 g, enviada separada. Não altera automaticamente outro produto do pedido.',5.00,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Bacon_%281%29.jpg/960px-Bacon_%281%29.jpg'),
 ('extras','Ingredientes Extras','Cheddar Extra 40 g','Pote de cheddar cremoso de 40 g, enviado separado. Contém leite.',4.50,NULL,'none','https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Sauchef_Cheddar_Cheese_Sauce.jpg/960px-Sauchef_Cheddar_Cheese_Sauce.jpg'),
 ('extras','Ingredientes Extras','Burger Bovino Extra 80 g','Disco de carne bovina de 80 g preparado na chapa e enviado separado. Não é um modificador automático de outro item.',8.00,NULL,'none','https://upload.wikimedia.org/wikipedia/commons/5/52/Hamburger_patty.jpg');


DO $seed$
DECLARE
  v_business uuid;
  v_category record;
  v_subcategory record;
  v_item record;
  v_count integer;
  v_product_limit integer;
  v_category_limit integer;
  v_new_categories integer;
  v_new_products integer;
  v_created_subcategories integer := 0;
BEGIN
  -- Três identificadores concordantes evitam atingir homônimos ou outro tenant.
  SELECT b.id INTO v_business FROM public.businesses b
  JOIN auth.users u ON u.id = b.owner_user_id
  WHERE b.id = 'abb14fb8-847b-4bb3-afef-1f4a3fd73f33'::uuid
    AND b.owner_user_id = '86776e6b-7ebb-4cbe-8b3a-1a9cc4359ca1'::uuid
    AND lower(u.email) = 'alexandre45648@gmail.com';
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Conta/estabelecimento PingoChef não encontrado com os identificadores esperados. Nenhum dado foi inserido.';
  END IF;
  PERFORM public.lock_business_capacity(v_business);
  IF NOT public.business_is_account_active(v_business) THEN
    RAISE EXCEPTION 'A conta PingoChef precisa estar ativa para receber o catálogo demonstrativo.';
  END IF;
  INSERT INTO _pingo_target VALUES (v_business);

  FOR v_category IN SELECT * FROM _pingo_categories ORDER BY position LOOP
    SELECT count(*) INTO v_count FROM public.categories
      WHERE business_id = v_business AND lower(btrim(name)) = lower(v_category.name);
    IF v_count > 1 THEN RAISE EXCEPTION 'Categoria duplicada: %. Resolva a ambiguidade antes de executar.', v_category.name; END IF;
    UPDATE _pingo_categories SET
      id = coalesce((SELECT id FROM public.categories WHERE business_id = v_business AND lower(btrim(name)) = lower(v_category.name)),
        md5(v_business::text || ':pingo-demo-v1:category:' || v_category.key)::uuid),
      is_new = (v_count = 0) WHERE key = v_category.key;
  END LOOP;

  SELECT count(*) INTO v_new_categories FROM _pingo_categories WHERE is_new;
  SELECT count(*) INTO v_new_products FROM _pingo_items i JOIN _pingo_categories c ON c.key = i.category_key
    WHERE NOT EXISTS (SELECT 1 FROM public.menu_items p WHERE p.business_id = v_business
      AND p.category_id = c.id AND lower(btrim(p.name)) = lower(i.name));
  v_product_limit := coalesce((public.business_feature_entitlement(v_business, 'MAX_PRODUCTS') #>> '{}')::integer, 0);
  v_category_limit := coalesce((public.business_feature_entitlement(v_business, 'MAX_CATEGORIES') #>> '{}')::integer, 0);
  IF v_new_categories > 0 AND (SELECT count(*) FROM public.categories WHERE business_id = v_business) + v_new_categories > v_category_limit THEN
    RAISE EXCEPTION 'Sem capacidade para % novas categorias (limite atual: %). O script não altera planos.', v_new_categories, v_category_limit;
  END IF;
  IF v_new_products > 0 AND (SELECT count(*) FROM public.menu_items WHERE business_id = v_business) + v_new_products > v_product_limit THEN
    RAISE EXCEPTION 'Sem capacidade para % novos produtos (limite atual: %). O script não altera planos.', v_new_products, v_product_limit;
  END IF;

  FOR v_category IN SELECT * FROM _pingo_categories WHERE is_new ORDER BY position LOOP
    INSERT INTO public.categories (id, business_id, name, description, icon, display_mode, display_order, is_active)
    VALUES (v_category.id, v_business, v_category.name, v_category.description, v_category.icon_key,
      'icon_text_side', (SELECT coalesce(max(display_order), -1) + 1 FROM public.categories WHERE business_id = v_business), true);
    -- A base conectada possui os metadados de ícone; a cadeia inicial usa apenas icon.
    IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'categories'
      AND column_name IN ('icon_type', 'icon_key')) = 2 THEN
      EXECUTE 'UPDATE public.categories SET icon_type = $1, icon_key = $2 WHERE id = $3 AND business_id = $4'
        USING '2d', v_category.icon_key, v_category.id, v_business;
    END IF;
  END LOOP;
  FOR v_subcategory IN SELECT s.*, c.id AS category_id FROM _pingo_subcategories s
    JOIN _pingo_categories c ON c.key = s.category_key ORDER BY c.position, s.position LOOP
    SELECT count(*) INTO v_count FROM public.subcategories WHERE business_id = v_business
      AND category_id = v_subcategory.category_id AND lower(btrim(name)) = lower(v_subcategory.name);
    IF v_count > 1 THEN RAISE EXCEPTION 'Subcategoria duplicada: %. Nenhuma alteração será mantida.', v_subcategory.name; END IF;
    UPDATE _pingo_subcategories SET
      id = coalesce((SELECT id FROM public.subcategories WHERE business_id = v_business
        AND category_id = v_subcategory.category_id AND lower(btrim(name)) = lower(v_subcategory.name)),
        md5(v_business::text || ':pingo-demo-v1:sub:' || v_subcategory.category_key || ':' || v_subcategory.name)::uuid),
      is_new = (v_count = 0) WHERE category_key = v_subcategory.category_key AND name = v_subcategory.name;
    IF v_count = 0 THEN
      INSERT INTO public.subcategories (id, business_id, category_id, name, display_order)
      SELECT s.id, v_business, v_subcategory.category_id, s.name,
        (SELECT coalesce(max(display_order), -1) + 1 FROM public.subcategories WHERE business_id = v_business AND category_id = v_subcategory.category_id)
      FROM _pingo_subcategories s WHERE s.category_key = v_subcategory.category_key AND s.name = v_subcategory.name;
      v_created_subcategories := v_created_subcategories + 1;
    END IF;
  END LOOP;

  FOR v_item IN SELECT i.*, c.id AS category_id, s.id AS subcategory_id FROM _pingo_items i
    JOIN _pingo_categories c ON c.key = i.category_key
    JOIN _pingo_subcategories s ON s.category_key = i.category_key AND s.name = i.subcategory_name ORDER BY i.position LOOP
    IF EXISTS (SELECT 1 FROM public.menu_items WHERE business_id = v_business
      AND category_id = v_item.category_id AND lower(btrim(name)) = lower(v_item.name)) THEN CONTINUE; END IF;
    INSERT INTO public.menu_items (id, business_id, category_id, subcategory_id, name, description,
      price, promotional_price, image_url, is_available, is_highlighted, highlight_type, likes_count, show_price, display_order)
    VALUES (md5(v_business::text || ':pingo-demo-v1:item:' || v_item.category_key || ':' || v_item.name)::uuid,
      v_business, v_item.category_id, v_item.subcategory_id, v_item.name, v_item.description,
      v_item.price, v_item.promotional_price, v_item.image_url, true, v_item.highlight_type <> 'none', v_item.highlight_type, 0, true,
      (SELECT coalesce(max(display_order), -1) + 1 FROM public.menu_items WHERE business_id = v_business AND category_id = v_item.category_id));
  END LOOP;
  RAISE NOTICE 'PingoChef: % categorias, % subcategorias e % produtos adicionados. Registros existentes preservados.',
    v_new_categories, v_created_subcategories, v_new_products;
END;
$seed$;

-- Resultado final da conta (inclui os registros que já existiam).
SELECT b.name AS estabelecimento, b.slug,
  (SELECT count(*) FROM public.categories WHERE business_id = b.id) AS categorias,
  (SELECT count(*) FROM public.subcategories WHERE business_id = b.id) AS subcategorias,
  (SELECT count(*) FROM public.menu_items WHERE business_id = b.id) AS produtos
FROM public.businesses b JOIN _pingo_target t ON t.business_id = b.id;
COMMIT;
