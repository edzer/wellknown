context("wkt2geojson")

test_that("convert point works", {
  point <- "POINT (116.4000000000000057 45.2000000000000028)"
  a <- wkt2geojson(point)
  expect_is(a, "geojson")
  expect_that(typeof(a), equals("list"))
  expect_match(a$geometry$type, "Point")
  expect_equal(unclass(a), list(type="Feature", geometry=list('type' = 'Point', 'coordinates' = c(116.4, 45.2))))
})

test_that("convert multipoint works", {
  mp <- "MULTIPOINT ((100.0000000000000000 3.1010000000000000), (101.0000000000000000 2.1000000000000001), (3.1400000000000001 2.1800000000000002))"
  b <- wkt2geojson(mp)
  expect_is(b, "geojson")
  expect_that(typeof(b), equals("list"))
  expect_match(b$geometry$type, "Multipoint")
  expect_equal(unclass(b), list(type="Feature", geometry=list(type = 'Multipoint', coordinates=list(c(100.0, 3.101), c(101.0, 2.1), c(3.14, 2.18)))))
})

test_that("convert linestring works", {
  st <- "LINESTRING (0 0 10, 2 1 20, 4 2 30, 5 4 40)"
  c <- wkt2geojson(st)
  expect_is(c, "geojson")
  expect_that(typeof(c), equals("list"))
  expect_match(c$geometry$type, "Linestring")
  expect_equal(unclass(c), list(type="Feature", geometry=list(type = 'Linestring',
                        coordinates = list(c(0.0, 0.0, 10.0), c(2.0, 1.0, 20.0),
                                           c(4.0, 2.0, 30.0), c(5.0, 4.0, 40.0)))))
})


test_that("convert polygon works", {
  poly <- "POLYGON ((100 1, 104 2, 101 3, 100 1), (100 1, 103 2, 101 5, 100 1))"
  tomatch <- list(type="Feature", geometry=list(type = 'Polygon',
                   coordinates=list(
                     list(c(100, 1), c(104, 2), c(101, 3), c(100, 1)),
                     list(c(100, 1), c(103, 2), c(101, 5), c(100, 1))
                   )))
  e <- wkt2geojson(poly)
  expect_is(e, "geojson")
  expect_equal(typeof(e), "list")
  expect_equal(typeof(e), "list")
  expect_match(e$geometry$type, "Polygon")
  expect_equal(unclass(e), tomatch)
})