#' Make WKT point objects
#'
#' @export
#'
#' @param ... A GeoJSON-like object representing a Point, LineString, Polygon, MultiPolygon, etc.
#' @param fmt Format string which indicates the number of digits to display after the
#' decimal point when formatting coordinates. Max: 20
#' @examples
#' ## single point
#' point(-116.4, 45.2)
#' point(0, 1)
#'
#' ## single point, from data.frame
#' df <- data.frame(lon=-116.4, lat=45.2)
#' point(df)
#'
#' ## many points, from data.frame
#' df <- us_cities[1:5,c('lat','long')]
#' point(df)
#'
#' ## single point, from a list
#' point(list(c(100.0, 3.101)))
#'
#' ## many points, from a list
#' point(list(c(100.0, 3.101), c(101.0, 2.1), c(3.14, 2.18)))
point <- function(..., fmt = 16) {
  UseMethod("point")
}

#' @export
point.numeric <- function(..., fmt = 16) {
  pts <- unlist(list(...))
  fmtcheck(fmt)
  checker(pts, 'POINT', 2)
  sprintf('POINT (%s)', paste0(format(pts, nsmall = fmt, trim = TRUE), collapse = " "))
}

#' @export
point.data.frame <- function(..., fmt = 16) {
  pts <- list(...)
  fmtcheck(fmt)
  str <- apply(pts[[1]], 1, function(x) paste0(format(x, nsmall = fmt, trim = TRUE), collapse = " "))
  sprintf('POINT (%s)', str)
}

#' @export
point.list <- function(..., fmt = 16) {
  pts <- list(...)[[1]]
  fmtcheck(fmt)
  str <- sapply(pts, function(x) paste0(format(x, nsmall = fmt, trim = TRUE), collapse = " "))
  sprintf('POINT (%s)', str)
}