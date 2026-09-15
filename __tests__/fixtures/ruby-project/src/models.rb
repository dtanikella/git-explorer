# Test Ruby project for git-explorer Ruby analysis tests.
# Exercises dynamic dispatch patterns: include/extend/prepend, singleton methods,
# attr macros, compact class paths, superclass chains, and reopened classes.

# src/models.rb
module Persistence
  def save
    "saved"
  end

  def load
    "loaded"
  end
end

module Logging
  def log_call
    "logged"
  end
end

class ApplicationRecord
  def initialize
    @id = 1
  end

  def find
    "found"
  end
end

class User < ApplicationRecord
  include Persistence
  include Logging
  prepend Auditing

  attr_accessor :name, :email
  attr_reader :id
  attr_writer :secret

  def initialize(name)
    super()
    @name = name
  end

  def self.create(name)
    user = new(name)
    user.save
    user
  end

  def display_name
    name
  end

  def greet
    "Hello, #{name}"
  end
end

class Admin::User < User
  def self.create(name)
    user = new(name)
    user.save
    user
  end

  def display_name
    "Admin #{name}"
  end
end

# Reopened class
class User
  def to_s
    "User: #{name}"
  end
end

module Auditing
  def track_action
    "tracked"
  end
end