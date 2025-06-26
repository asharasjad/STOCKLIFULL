-- Sample data for testing InventoryPro

-- Sample products for each category
INSERT OR IGNORE INTO products (name, sku, description, category_id, selling_price, stock_quantity, min_stock_level, reorder_point) VALUES
-- Starters (category_id = 1)
('Chicken Wings', 'STR-001', 'Crispy buffalo chicken wings with celery sticks', 1, 8.99, 50, 10, 15),
('Garlic Bread', 'STR-002', 'Homemade garlic bread with herbs', 1, 4.99, 30, 5, 10),
('Mozzarella Sticks', 'STR-003', 'Golden fried mozzarella with marinara sauce', 1, 6.99, 25, 5, 10),

-- Mains (category_id = 2)
('Fish & Chips', 'MAIN-001', 'Beer battered cod with chunky chips', 2, 14.99, 20, 3, 5),
('Beef Burger', 'MAIN-002', 'Premium beef burger with fries', 2, 12.99, 30, 5, 10),
('Chicken Caesar Salad', 'MAIN-003', 'Grilled chicken with Caesar dressing', 2, 11.99, 15, 3, 8),

-- Chicken (category_id = 3)
('Waka Waka Chicken', 'CHK-001', 'Signature spiced chicken with rice', 3, 13.99, 40, 8, 12),
('Grilled Wings', 'CHK-002', 'Flame grilled chicken wings', 3, 9.99, 35, 7, 10),
('Chicken Tikka', 'CHK-003', 'Marinated chicken tikka pieces', 3, 15.99, 25, 5, 8),

-- Pizzas (category_id = 4)
('Margherita Pizza', 'PIZ-001', 'Classic tomato base with mozzarella', 4, 10.99, 50, 10, 15),
('Pepperoni Pizza', 'PIZ-002', 'Pepperoni with mozzarella cheese', 4, 12.99, 45, 8, 12),
('Meat Feast Pizza', 'PIZ-003', 'Pepperoni, ham, sausage, and beef', 4, 16.99, 30, 5, 10),

-- Pastas (category_id = 5)
('Spaghetti Bolognese', 'PAS-001', 'Classic meat sauce with parmesan', 5, 11.99, 40, 8, 12),
('Chicken Alfredo', 'PAS-002', 'Creamy alfredo sauce with grilled chicken', 5, 13.99, 25, 5, 8),
('Penne Arrabbiata', 'PAS-003', 'Spicy tomato sauce with herbs', 5, 9.99, 30, 6, 10),

-- Drinks (category_id = 6)
('Coca Cola', 'DRK-001', 'Classic Coca Cola 330ml', 6, 2.99, 100, 20, 30),
('Orange Juice', 'DRK-002', 'Fresh orange juice 250ml', 6, 3.49, 50, 10, 20),
('Coffee', 'DRK-003', 'Freshly brewed coffee', 6, 2.49, 200, 40, 60),

-- Desserts (category_id = 7)
('Chocolate Brownie', 'DES-001', 'Warm chocolate brownie with ice cream', 7, 6.99, 20, 4, 8),
('Tiramisu', 'DES-002', 'Classic Italian tiramisu', 7, 7.99, 15, 3, 6),
('Cheesecake', 'DES-003', 'New York style cheesecake', 7, 6.49, 12, 2, 5);