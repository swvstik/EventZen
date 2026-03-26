package com.eventzen.dto.response;

import lombok.Getter;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

@Getter
public class PagedResponse<T> {
    private final List<T> events;
    private final long totalCount;
    private final int totalPages;
    private final int currentPage;

    public PagedResponse(Page<?> page, Function<Object, T> mapper) {
        //noinspection unchecked
        this.events      = page.getContent().stream().map(e -> mapper.apply(e)).toList();
        this.totalCount  = page.getTotalElements();
        this.totalPages  = page.getTotalPages();
        this.currentPage = page.getNumber();
    }
}
