package com.example.travel.mapper;

import com.example.travel.dto.UserDto;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper {
    int insertUser(UserDto user);
    int existsByEmail(String email);
    UserDto findByEmail(String email);
}